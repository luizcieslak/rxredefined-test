const {
  scoreOrder,
  scoreBreakdown,
  rankOrders,
  minutesWaiting,
} = require('../src/modules/priority');

// Frozen clock for every test. Nothing here reads Date.now().
const NOW = new Date('2026-06-15T12:00:00Z');

const minutesAgo = (m) => new Date(NOW.getTime() - m * 60 * 1000);
const minutesFromNow = (m) => new Date(NOW.getTime() + m * 60 * 1000);
const secondsAgo = (s) => new Date(NOW.getTime() - s * 1000);

const SALMON = { prep_time_minutes: 20 };
const CAESAR = { prep_time_minutes: 10 };
const PIZZA = { prep_time_minutes: 12 };

// Baseline order that scores only its type points (dine_in = 30):
// placed just now, no VIP, no promise, prep under 15 minutes.
function makeOrder(overrides = {}) {
  return {
    id: 1,
    type: 'dine_in',
    is_vip: false,
    placed_at: NOW,
    promised_at: null,
    items: [{ ...CAESAR, quantity: 1 }],
    ...overrides,
  };
}

// Spec section 5.3, Example A.
const exampleA = makeOrder({
  id: 1,
  type: 'dine_in',
  placed_at: new Date('2026-06-15T11:25:00Z'),
  items: [
    { ...SALMON, quantity: 2 },
    { ...CAESAR, quantity: 1 },
  ],
});

// Spec section 5.3, Example B.
const exampleB = makeOrder({
  id: 2,
  type: 'delivery',
  is_vip: true,
  placed_at: new Date('2026-06-15T11:50:00Z'),
  promised_at: new Date('2026-06-15T12:20:00Z'),
  items: [{ ...PIZZA, quantity: 1 }],
});

describe('worked examples (spec 5.3)', () => {
  test('Example A scores 60', () => {
    expect(scoreBreakdown(exampleA, NOW)).toEqual({
      type: 30,
      vip: 0,
      wait_time: 15,
      promised: 0,
      complexity: 15,
      total: 60,
    });
  });

  test('Example B scores 60', () => {
    expect(scoreBreakdown(exampleB, NOW)).toEqual({
      type: 10,
      vip: 20,
      wait_time: 5,
      promised: 25,
      complexity: 0,
      total: 60,
    });
  });

  test('B ranks above A on the promised_at tie-break', () => {
    const ranked = rankOrders([exampleA, exampleB], NOW);
    expect(ranked.map((o) => o.id)).toEqual([2, 1]);
    expect(ranked.map((o) => o.score)).toEqual([60, 60]);
  });
});

describe('order type and VIP', () => {
  test.each([
    ['dine_in', 30],
    ['takeout', 20],
    ['delivery', 10],
  ])('%s is worth %i points', (type, points) => {
    expect(scoreBreakdown(makeOrder({ type }), NOW).type).toBe(points);
  });

  test('VIP adds 20 points', () => {
    expect(scoreOrder(makeOrder({ is_vip: true }), NOW)).toBe(
      scoreOrder(makeOrder({ is_vip: false }), NOW) + 20,
    );
  });

  test('unknown type throws instead of scoring NaN', () => {
    expect(() => scoreOrder(makeOrder({ type: 'drive_thru' }), NOW)).toThrow(/Unknown order type/);
  });
});

describe('wait time', () => {
  const waitPoints = (placed_at) => scoreBreakdown(makeOrder({ placed_at }), NOW).wait_time;

  test('9 minutes 50 seconds is 9 whole minutes = 0 points', () => {
    expect(minutesWaiting(makeOrder({ placed_at: secondsAgo(9 * 60 + 50) }), NOW)).toBe(9);
    expect(waitPoints(secondsAgo(9 * 60 + 50))).toBe(0);
  });

  test('exactly 10 minutes = 5 points', () => {
    expect(waitPoints(minutesAgo(10))).toBe(5);
  });

  test('79 minutes = 35 points, just under the cap', () => {
    expect(waitPoints(minutesAgo(79))).toBe(35);
  });

  test('caps at 40 points (80 minutes and beyond)', () => {
    expect(waitPoints(minutesAgo(80))).toBe(40);
    expect(waitPoints(minutesAgo(300))).toBe(40);
  });

  test('placed_at in the future clamps to 0 instead of going negative', () => {
    expect(minutesWaiting(makeOrder({ placed_at: minutesFromNow(5) }), NOW)).toBe(0);
    expect(waitPoints(minutesFromNow(5))).toBe(0);
  });
});

describe('complexity', () => {
  const complexityPoints = (items) => scoreBreakdown(makeOrder({ items }), NOW).complexity;

  test('14 prep minutes = 0 points', () => {
    expect(complexityPoints([{ prep_time_minutes: 7, quantity: 2 }])).toBe(0);
  });

  test('15 prep minutes = 5 points', () => {
    expect(complexityPoints([{ prep_time_minutes: 5, quantity: 3 }])).toBe(5);
  });

  test('sums prep_time * quantity across items', () => {
    // 20*2 + 10*1 = 50 -> floor(50/15)*5 = 15
    expect(complexityPoints([
      { ...SALMON, quantity: 2 },
      { ...CAESAR, quantity: 1 },
    ])).toBe(15);
  });

  test('caps at 20 points (60 prep minutes and beyond)', () => {
    expect(complexityPoints([{ prep_time_minutes: 20, quantity: 3 }])).toBe(20);
    expect(complexityPoints([{ prep_time_minutes: 30, quantity: 10 }])).toBe(20);
  });
});

describe('promised_at buckets', () => {
  const promisedPoints = (promised_at, type = 'delivery') =>
    scoreBreakdown(makeOrder({ type, promised_at }), NOW).promised;

  test.each([
    ['20 minutes away', minutesFromNow(20), 25],
    ['exactly 30 minutes away (inclusive)', minutesFromNow(30), 25],
    ['30 minutes 30 seconds away', new Date(minutesFromNow(30).getTime() + 30 * 1000), 15],
    ['45 minutes away', minutesFromNow(45), 15],
    ['exactly 60 minutes away (inclusive)', minutesFromNow(60), 15],
    ['61 minutes away', minutesFromNow(61), 0],
    ['already overdue', minutesAgo(5), 25],
    ['null', null, 0],
  ])('%s -> %i points', (_label, promised_at, points) => {
    expect(promisedPoints(promised_at)).toBe(points);
  });

  test('takeout promises count the same as delivery', () => {
    expect(promisedPoints(minutesFromNow(20), 'takeout')).toBe(25);
  });

  test('dine_in ignores promised_at', () => {
    expect(promisedPoints(minutesFromNow(20), 'dine_in')).toBe(0);
  });
});

describe('ranking and tie-break', () => {
  test('sorts by score, highest first', () => {
    const low = makeOrder({ id: 1, type: 'delivery' }); // 10
    const high = makeOrder({ id: 2, type: 'dine_in' }); // 30
    const mid = makeOrder({ id: 3, type: 'takeout' }); // 20
    expect(rankOrders([low, high, mid], NOW).map((o) => o.id)).toEqual([2, 3, 1]);
  });

  test('equal score: earlier promised_at first', () => {
    // Both promises are > 60 minutes away, so they add 0 points and only break the tie.
    const later = makeOrder({ id: 1, type: 'takeout', promised_at: minutesFromNow(180) });
    const earlier = makeOrder({ id: 2, type: 'takeout', promised_at: minutesFromNow(120) });
    const ranked = rankOrders([later, earlier], NOW);
    expect(ranked[0].score).toBe(ranked[1].score);
    expect(ranked.map((o) => o.id)).toEqual([2, 1]);
  });

  test('equal score: null promised_at goes last', () => {
    const noPromise = makeOrder({ id: 1, type: 'takeout', promised_at: null });
    const promised = makeOrder({ id: 2, type: 'takeout', promised_at: minutesFromNow(120) });
    expect(rankOrders([noPromise, promised], NOW).map((o) => o.id)).toEqual([2, 1]);
  });

  test('equal score and promise: earlier placed_at first', () => {
    // 1 and 5 minutes waiting both give 0 wait points.
    const newer = makeOrder({ id: 1, placed_at: minutesAgo(1) });
    const older = makeOrder({ id: 2, placed_at: minutesAgo(5) });
    expect(rankOrders([newer, older], NOW).map((o) => o.id)).toEqual([2, 1]);
  });

  test('everything equal: smaller id first', () => {
    const b = makeOrder({ id: 7 });
    const a = makeOrder({ id: 3 });
    expect(rankOrders([b, a], NOW).map((o) => o.id)).toEqual([3, 7]);
  });

  test('dine_in promised_at scores nothing but wins the tie-break over a null promise', () => {
    // The promised order is placed later and has the higher id, so only the
    // promise can rank it first. Its 15-minute promise adds no points.
    const noPromisePlacedEarlier = makeOrder({ id: 1, placed_at: minutesAgo(8) });
    const promisedPlacedLater = makeOrder({
      id: 2,
      placed_at: minutesAgo(2),
      promised_at: minutesFromNow(15),
    });
    const ranked = rankOrders([noPromisePlacedEarlier, promisedPlacedLater], NOW);
    expect(ranked.map((o) => [o.id, o.score])).toEqual([[2, 30], [1, 30]]);
  });

  test('two tied dine_in orders with promises: earlier promise first', () => {
    const later = makeOrder({ id: 1, promised_at: minutesFromNow(90) });
    const earlier = makeOrder({ id: 2, promised_at: minutesFromNow(45) });
    expect(rankOrders([later, earlier], NOW).map((o) => o.id)).toEqual([2, 1]);
  });

  test('tie across types: an earlier dine_in promise outranks a later takeout promise', () => {
    // takeout: 20 type + 10 wait (20 min) + 0 promised (120 min away) = 30
    // dine_in: 30 type + 0 wait + 0 (dine_in promises score nothing) = 30
    const takeout = makeOrder({
      id: 1,
      type: 'takeout',
      placed_at: minutesAgo(20),
      promised_at: minutesFromNow(120),
    });
    const dineIn = makeOrder({ id: 2, placed_at: NOW, promised_at: minutesFromNow(30) });
    const ranked = rankOrders([takeout, dineIn], NOW);
    expect(ranked.map((o) => [o.id, o.score])).toEqual([[2, 30], [1, 30]]);
  });

  test('a delivery VIP with a tight promise beats a dine_in non-VIP', () => {
    const dineIn = makeOrder({ id: 1, type: 'dine_in', placed_at: minutesAgo(5) }); // 30
    const deliveryVip = makeOrder({
      id: 2,
      type: 'delivery',
      is_vip: true,
      placed_at: minutesAgo(5),
      promised_at: minutesFromNow(15),
    }); // 10 + 20 + 25 = 55
    const ranked = rankOrders([dineIn, deliveryVip], NOW);
    expect(ranked.map((o) => [o.id, o.score])).toEqual([[2, 55], [1, 30]]);
  });

  test('attaches minutes_waiting computed with the same now', () => {
    const [ranked] = rankOrders([exampleA], NOW);
    expect(ranked.minutes_waiting).toBe(35);
  });

  test('does not mutate the input', () => {
    const input = [exampleA, exampleB];
    rankOrders(input, NOW);
    expect(input).toEqual([exampleA, exampleB]);
    expect(exampleA).not.toHaveProperty('score');
  });
});

describe('purity', () => {
  afterEach(() => jest.useRealTimers());

  test('the system clock has no effect; only the now argument matters', () => {
    jest.useFakeTimers({ now: new Date('1999-01-01T00:00:00Z') });
    expect(scoreOrder(exampleA, NOW)).toBe(60);
    jest.setSystemTime(new Date('2040-01-01T00:00:00Z'));
    expect(scoreOrder(exampleA, NOW)).toBe(60);
  });

  test('accepts ISO strings as timestamps (UTC)', () => {
    const fromStrings = {
      ...exampleB,
      placed_at: '2026-06-15T11:50:00Z',
      promised_at: '2026-06-15T12:20:00.000Z',
    };
    expect(scoreOrder(fromStrings, '2026-06-15T12:00:00Z')).toBe(60);
  });

  test('rejects an invalid now', () => {
    expect(() => scoreOrder(exampleA, 'not a date')).toThrow(/Invalid timestamp for now/);
  });
});
