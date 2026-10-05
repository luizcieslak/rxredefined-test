// @ts-check
// Pure: time-dependent functions take `now` as an argument, never the clock.
// Timestamps are compared as epoch ms, which is UTC.

/** @typedef {'dine_in' | 'takeout' | 'delivery'} OrderType */

/** @typedef {Date | string} Timestamp */

/**
 * @typedef {object} ScorableItem
 * @property {number} quantity
 * @property {number} prep_time_minutes
 */

/**
 * @typedef {object} ScorableOrder
 * @property {number} id
 * @property {OrderType} type
 * @property {boolean} is_vip
 * @property {Timestamp} placed_at
 * @property {Timestamp | null} promised_at
 * @property {ScorableItem[]} items
 */

/** @typedef {ScorableOrder & { score: number }} ScoredOrder */

/**
 * @typedef {object} ScoreBreakdown
 * @property {number} type
 * @property {number} vip
 * @property {number} wait_time
 * @property {number} promised
 * @property {number} complexity
 * @property {number} total
 */

/**
 * @typedef {object} SteppedRule
 * @property {number} minutesPerStep
 * @property {number} pointsPerStep
 * @property {number} maxPoints
 */

/**
 * @typedef {object} PromisedBucket
 * @property {number} maxMinutesUntil Inclusive upper bound.
 * @property {number} points
 */

/**
 * @typedef {object} PriorityRules
 * @property {Record<OrderType, number>} typePoints
 * @property {number} vipPoints
 * @property {SteppedRule} waitTime
 * @property {{ appliesTo: OrderType[], buckets: PromisedBucket[] }} promised
 * @property {SteppedRule} complexity
 */

const MS_PER_MINUTE = 60 * 1000;

/**
 * Every ranking knob lives here; a ranking change should only touch this object.
 * @type {PriorityRules}
 */
const PRIORITY_RULES = {
  typePoints: { dine_in: 30, takeout: 20, delivery: 10 },
  vipPoints: 20,
  waitTime: { minutesPerStep: 10, pointsPerStep: 5, maxPoints: 40 },
  promised: {
    // promised_at only scores points for these types. The tie-break uses
    // promised_at for every type (see DECISIONS.md).
    appliesTo: ['takeout', 'delivery'],
    // Checked in order; upper bounds are inclusive. Overdue promises
    // (negative minutes until) fall into the first bucket.
    buckets: [
      { maxMinutesUntil: 30, points: 25 },
      { maxMinutesUntil: 60, points: 15 },
    ],
  },
  complexity: { minutesPerStep: 15, pointsPerStep: 5, maxPoints: 20 },
};

/**
 * @param {Timestamp} value
 * @param {string} field Name used in the error message.
 * @returns {number} Epoch milliseconds.
 * @throws {TypeError} If the value is not a valid timestamp.
 */
function toMillis(value, field) {
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (Number.isNaN(ms)) {
    throw new TypeError(`Invalid timestamp for ${field}: ${value}`);
  }
  return ms;
}

/**
 * `min(maxPoints, floor(amount / minutesPerStep) * pointsPerStep)`
 * @param {number} amount
 * @param {SteppedRule} rule
 * @returns {number}
 */
function steppedPoints(amount, { minutesPerStep, pointsPerStep, maxPoints }) {
  return Math.min(maxPoints, Math.floor(amount / minutesPerStep) * pointsPerStep);
}

/**
 * Whole minutes since placed_at, floored. Clamped at 0 for clock skew.
 * @param {Pick<ScorableOrder, 'placed_at'>} order
 * @param {Timestamp} now
 * @returns {number}
 */
function minutesWaiting(order, now) {
  const elapsedMs = toMillis(now, 'now') - toMillis(order.placed_at, 'placed_at');
  return Math.max(0, Math.floor(elapsedMs / MS_PER_MINUTE));
}

/**
 * @param {Pick<ScorableOrder, 'items'>} order
 * @returns {number}
 */
function totalPrepMinutes(order) {
  return order.items.reduce((sum, item) => sum + item.prep_time_minutes * item.quantity, 0);
}

/**
 * Promise that earns points: only for types in PRIORITY_RULES.promised.appliesTo.
 * @param {Pick<ScorableOrder, 'type' | 'promised_at'>} order
 * @returns {number | null}
 */
function scorablePromisedAt(order) {
  if (!PRIORITY_RULES.promised.appliesTo.includes(order.type)) return null;
  return tieBreakPromisedAt(order);
}

/**
 * Promise used to break ties, for any type: a dine_in promise earns no points
 * but still ranks ahead of a tied order with no promise.
 * @param {Pick<ScorableOrder, 'promised_at'>} order
 * @returns {number | null}
 */
function tieBreakPromisedAt(order) {
  if (order.promised_at == null) return null;
  return toMillis(order.promised_at, 'promised_at');
}

/**
 * @param {Pick<ScorableOrder, 'type'>} order
 * @returns {number}
 * @throws {TypeError} If the order type has no configured points.
 */
function typePoints(order) {
  const points = PRIORITY_RULES.typePoints[order.type];
  if (points === undefined) {
    throw new TypeError(`Unknown order type: ${order.type}`);
  }
  return points;
}

/**
 * @param {Pick<ScorableOrder, 'type' | 'promised_at'>} order
 * @param {Timestamp} now
 * @returns {number}
 */
function promisedPoints(order, now) {
  const promisedAt = scorablePromisedAt(order);
  if (promisedAt === null) return 0;
  // Not floored: 30m30s away is beyond 30 minutes and falls in the next bucket.
  const minutesUntil = (promisedAt - toMillis(now, 'now')) / MS_PER_MINUTE;
  const bucket = PRIORITY_RULES.promised.buckets.find((b) => minutesUntil <= b.maxMinutesUntil);
  return bucket ? bucket.points : 0;
}

/**
 * Per-component points plus total.
 * @param {ScorableOrder} order
 * @param {Timestamp} now
 * @returns {ScoreBreakdown}
 */
function scoreBreakdown(order, now) {
  const breakdown = {
    type: typePoints(order),
    vip: order.is_vip ? PRIORITY_RULES.vipPoints : 0,
    wait_time: steppedPoints(minutesWaiting(order, now), PRIORITY_RULES.waitTime),
    promised: promisedPoints(order, now),
    complexity: steppedPoints(totalPrepMinutes(order), PRIORITY_RULES.complexity),
  };
  const total = Object.values(breakdown).reduce((sum, points) => sum + points, 0);
  return { ...breakdown, total };
}

/**
 * @param {ScorableOrder} order
 * @param {Timestamp} now
 * @returns {number}
 */
function scoreOrder(order, now) {
  return scoreBreakdown(order, now).total;
}

/**
 * score desc, then promised_at asc (null last, any type), placed_at asc, id asc.
 * @param {ScoredOrder} a
 * @param {ScoredOrder} b
 * @returns {number}
 */
function compareByPriority(a, b) {
  if (a.score !== b.score) return b.score - a.score;

  const aPromised = tieBreakPromisedAt(a);
  const bPromised = tieBreakPromisedAt(b);
  if (aPromised !== bPromised) {
    if (aPromised === null) return 1;
    if (bPromised === null) return -1;
    return aPromised - bPromised;
  }

  const placedDiff = toMillis(a.placed_at, 'placed_at') - toMillis(b.placed_at, 'placed_at');
  if (placedDiff !== 0) return placedDiff;

  return a.id - b.id;
}

/**
 * New objects with `score` and `minutes_waiting`, sorted. Input is not mutated.
 * @template {ScorableOrder} T
 * @param {T[]} orders
 * @param {Timestamp} now
 * @returns {Array<T & { score: number, minutes_waiting: number }>}
 */
function rankOrders(orders, now) {
  return orders
    .map((order) => ({
      ...order,
      score: scoreOrder(order, now),
      minutes_waiting: minutesWaiting(order, now),
    }))
    .sort(compareByPriority);
}

module.exports = {
  PRIORITY_RULES,
  scoreOrder,
  scoreBreakdown,
  compareByPriority,
  rankOrders,
  minutesWaiting,
  totalPrepMinutes,
};
