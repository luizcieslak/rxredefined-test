const {
  ALLOWED_TRANSITIONS,
  ACTION_TARGET_STATUS,
  ORDER_STATUSES,
  canTransition,
  assertTransition,
  allowedActions,
} = require('../src/modules/transitions');
const { DomainError } = require('../src/errors');

/** Runs fn and returns the thrown error, failing the test if nothing is thrown. */
function thrownBy(fn) {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error('Expected function to throw');
}

describe('legal transitions', () => {
  test.each([
    ['received', 'preparing'],
    ['received', 'cancelled'],
    ['preparing', 'ready'],
    ['ready', 'picked_up'],
  ])('%s -> %s succeeds', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
    expect(assertTransition(from, to)).toBe(to);
  });

  test('those four are the only legal transitions', () => {
    const legal = ORDER_STATUSES.flatMap((from) =>
      ORDER_STATUSES.filter((to) => canTransition(from, to)).map((to) => `${from}->${to}`),
    );
    expect(legal).toEqual([
      'received->preparing',
      'received->cancelled',
      'preparing->ready',
      'ready->picked_up',
    ]);
  });
});

describe('illegal transitions', () => {
  test.each([
    ['received', 'ready'],
    ['received', 'picked_up'],
    ['preparing', 'picked_up'],
  ])('skipping a step: %s -> %s is rejected', (from, to) => {
    expect(() => assertTransition(from, to)).toThrow(DomainError);
  });

  test.each(ORDER_STATUSES.map((status) => [status, status]))(
    'repeating the same status: %s -> %s is rejected',
    (status) => {
      expect(() => assertTransition(status, status)).toThrow(DomainError);
    },
  );

  test.each(['picked_up', 'cancelled'].flatMap((from) => ORDER_STATUSES.map((to) => [from, to])))(
    'leaving a terminal status: %s -> %s is rejected',
    (from, to) => {
      expect(() => assertTransition(from, to)).toThrow(DomainError);
    },
  );

  test.each([
    ['preparing', 'received'],
    ['ready', 'preparing'],
  ])('moving backwards: %s -> %s is rejected', (from, to) => {
    expect(() => assertTransition(from, to)).toThrow(DomainError);
  });

  test('cancelling a preparing order is rejected (cancel is only from received)', () => {
    expect(() => assertTransition('preparing', 'cancelled')).toThrow(DomainError);
  });

  test.each([
    ['unknown', 'preparing'],
    ['received', 'unknown'],
    ['constructor', 'preparing'],
  ])('unknown status: %s -> %s is rejected', (from, to) => {
    expect(() => assertTransition(from, to)).toThrow(DomainError);
  });

  test('error carries a stable code and the attempted transition', () => {
    const error = thrownBy(() => assertTransition('preparing', 'preparing'));
    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('INVALID_TRANSITION');
    expect(error.details).toEqual({ from: 'preparing', to: 'preparing' });
    expect(error.message).toMatch(/preparing/);
  });
});

describe('actions', () => {
  test('each action maps to its destination status', () => {
    expect(ACTION_TARGET_STATUS).toEqual({
      start: 'preparing',
      ready: 'ready',
      pickup: 'picked_up',
      cancel: 'cancelled',
    });
  });

  test('starting an order that is already preparing is rejected', () => {
    expect(() => assertTransition('preparing', ACTION_TARGET_STATUS.start)).toThrow(DomainError);
  });

  test.each([
    ['received', ['start', 'cancel']],
    ['preparing', ['ready']],
    ['ready', ['pickup']],
    ['picked_up', []],
    ['cancelled', []],
    ['unknown', []],
  ])('allowed actions from %s: %j', (status, actions) => {
    expect(allowedActions(status)).toEqual(actions);
  });
});

describe('map integrity', () => {
  test('terminal statuses have no outgoing transitions', () => {
    expect(ALLOWED_TRANSITIONS.picked_up).toEqual([]);
    expect(ALLOWED_TRANSITIONS.cancelled).toEqual([]);
  });

  test('every destination in the map is a known status', () => {
    for (const targets of Object.values(ALLOWED_TRANSITIONS)) {
      for (const to of targets) expect(ORDER_STATUSES).toContain(to);
    }
    for (const to of Object.values(ACTION_TARGET_STATUS)) expect(ORDER_STATUSES).toContain(to);
  });

  test('the map cannot be mutated at runtime', () => {
    expect(Object.isFrozen(ALLOWED_TRANSITIONS)).toBe(true);
    expect(Object.isFrozen(ALLOWED_TRANSITIONS.received)).toBe(true);
    expect(Object.isFrozen(ACTION_TARGET_STATUS)).toBe(true);
  });
});
