// @ts-check
// A transition is legal only if `to` is listed under `from` in ALLOWED_TRANSITIONS.

const { DomainError, ERROR_CODES } = require('../errors');

/** @typedef {'received' | 'preparing' | 'ready' | 'picked_up' | 'cancelled'} OrderStatus */

/** @typedef {'start' | 'ready' | 'pickup' | 'cancel'} OrderAction */

/** @type {Readonly<Record<OrderStatus, readonly OrderStatus[]>>}
 */
const ALLOWED_TRANSITIONS = Object.freeze({
  received: Object.freeze(/** @type {OrderStatus[]} */ (['preparing', 'cancelled'])),
  preparing: Object.freeze(/** @type {OrderStatus[]} */ (['ready'])),
  ready: Object.freeze(/** @type {OrderStatus[]} */ (['picked_up'])),
  picked_up: Object.freeze(/** @type {OrderStatus[]} */ ([])),
  cancelled: Object.freeze(/** @type {OrderStatus[]} */ ([])),
});

/**
 * Destination only; which source statuses are valid is ALLOWED_TRANSITIONS' job.
 * @type {Readonly<Record<OrderAction, OrderStatus>>}
 */
const ACTION_TARGET_STATUS = Object.freeze({
  start: 'preparing',
  ready: 'ready',
  pickup: 'picked_up',
  cancel: 'cancelled',
});

/** @type {OrderStatus[]} */
const ORDER_STATUSES = /** @type {OrderStatus[]} */ (Object.keys(ALLOWED_TRANSITIONS));

/**
 * @param {string} from
 * @param {string} to
 * @returns {boolean}
 */
function canTransition(from, to) {
  if (!Object.hasOwn(ALLOWED_TRANSITIONS, from)) return false;
  return ALLOWED_TRANSITIONS[/** @type {OrderStatus} */ (from)].includes(
    /** @type {OrderStatus} */ (to),
  );
}

/**
 * @param {string} from
 * @param {string} to
 * @returns {OrderStatus}
 * @throws {DomainError} INVALID_TRANSITION when the map does not allow it.
 */
function assertTransition(from, to) {
  if (!canTransition(from, to)) {
    throw new DomainError(
      ERROR_CODES.INVALID_TRANSITION,
      `Cannot change order status from '${from}' to '${to}'`,
      { from, to },
    );
  }
  return /** @type {OrderStatus} */ (to);
}

/**
 * Lets the UI show only valid buttons without holding a copy of the rules.
 * @param {string} status
 * @returns {OrderAction[]}
 */
function allowedActions(status) {
  const actions = /** @type {OrderAction[]} */ (Object.keys(ACTION_TARGET_STATUS));
  return actions.filter((action) => canTransition(status, ACTION_TARGET_STATUS[action]));
}

module.exports = {
  ALLOWED_TRANSITIONS,
  ACTION_TARGET_STATUS,
  ORDER_STATUSES,
  canTransition,
  assertTransition,
  allowedActions,
};
