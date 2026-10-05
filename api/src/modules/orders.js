// @ts-check

const { DomainError, ERROR_CODES } = require('../errors');
const { rankOrders } = require('./priority');
const { ACTION_TARGET_STATUS, assertTransition, allowedActions } = require('./transitions');

/** @typedef {import('../repositories/orders').OrderRecord} OrderRecord */
/** @typedef {import('./transitions').OrderAction} OrderAction */
/** @typedef {import('./transitions').OrderStatus} OrderStatus */

/**
 * @typedef {OrderRecord & { allowed_actions: OrderAction[] }} OrderView
 * @typedef {OrderView & { score: number, minutes_waiting: number }} QueueEntry
 */

/**
 * @typedef {object} OrdersRepository
 * @property {(statuses: readonly string[]) => Promise<OrderRecord[]>} findByStatuses
 * @property {(id: number) => Promise<OrderRecord | null>} findById
 * @property {(id: number, from: string, to: string) => Promise<boolean>} updateStatusIfCurrent
 */

/**
 * Statuses that make up the active queue. Also the only valid `status` filters.
 * @type {readonly OrderStatus[]}
 */
const ACTIVE_QUEUE_STATUSES = Object.freeze(/** @type {OrderStatus[]} */ (['received', 'preparing']));

/**
 * @template {OrderRecord} T
 * @param {T} order
 * @returns {T & { allowed_actions: OrderAction[] }}
 */
function withAllowedActions(order) {
  return { ...order, allowed_actions: allowedActions(order.status) };
}

/**
 * @param {unknown} status Raw filter; undefined means the whole active queue.
 * @returns {readonly string[]}
 * @throws {DomainError} INVALID_STATUS_FILTER
 */
function statusesFor(status) {
  if (status === undefined) return ACTIVE_QUEUE_STATUSES;
  if (typeof status === 'string' && ACTIVE_QUEUE_STATUSES.includes(/** @type {OrderStatus} */ (status))) {
    return [status];
  }
  throw new DomainError(
    ERROR_CODES.INVALID_STATUS_FILTER,
    `status must be one of: ${ACTIVE_QUEUE_STATUSES.join(', ')}`,
    { status, allowed: ACTIVE_QUEUE_STATUSES },
  );
}

/** @param {{ repository: OrdersRepository }} deps */
function createOrdersService({ repository }) {
  return {
    /**
     * Active orders ranked by priority, scored against `now`.
     * @param {{ status?: unknown }} filter
     * @param {Date} now
     * @returns {Promise<QueueEntry[]>}
     */
    async getQueue({ status }, now) {
      const orders = await repository.findByStatuses(statusesFor(status));
      return rankOrders(orders, now).map(withAllowedActions);
    },

    /**
     * @param {number} id
     * @param {OrderAction} action
     * @returns {Promise<OrderView>}
     * @throws {DomainError} ORDER_NOT_FOUND or INVALID_TRANSITION
     */
    async applyAction(id, action) {
      const order = await repository.findById(id);
      if (!order) {
        throw new DomainError(ERROR_CODES.ORDER_NOT_FOUND, `Order ${id} not found`, { id });
      }

      const to = assertTransition(order.status, ACTION_TARGET_STATUS[action]);

      // Another request may have changed the status since we read it.
      const updated = await repository.updateStatusIfCurrent(id, order.status, to);
      if (!updated) {
        const current = await repository.findById(id);
        if (!current) {
          throw new DomainError(ERROR_CODES.ORDER_NOT_FOUND, `Order ${id} not found`, { id });
        }
        throw new DomainError(
          ERROR_CODES.INVALID_TRANSITION,
          `Order ${id} changed to '${current.status}' before it could move to '${to}'`,
          { from: current.status, to },
        );
      }

      return withAllowedActions({ ...order, status: to });
    },
  };
}

/** @typedef {ReturnType<typeof createOrdersService>} OrdersService */

module.exports = { ACTIVE_QUEUE_STATUSES, createOrdersService };
