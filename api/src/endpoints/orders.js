// @ts-check
// HTTP endpoints for orders. Thin: read the request, call the module, write
// the response. No business rules here.

const express = require('express');
const { DomainError, ERROR_CODES } = require('../errors');

/** @typedef {import('../modules/orders').OrdersService} OrdersService */
/** @typedef {import('../modules/transitions').OrderAction} OrderAction */
/** @typedef {{ now: () => Date }} Clock */

/**
 * @param {string} raw `:id` route param.
 * @returns {number}
 * @throws {DomainError} INVALID_ORDER_ID unless it is a positive integer.
 */
function parseOrderId(raw) {
  if (!/^[1-9]\d{0,9}$/.test(raw) || Number(raw) > 2147483647) {
    throw new DomainError(ERROR_CODES.INVALID_ORDER_ID, 'Order id must be a positive integer', {
      id: raw,
    });
  }
  return Number(raw);
}

/**
 * @param {{ ordersService: OrdersService, clock: Clock }} deps
 * @returns {express.Router}
 */
function createOrdersRouter({ ordersService, clock }) {
  const router = express.Router();

  router.get('/queue', async (req, res) => {
    const orders = await ordersService.getQueue({ status: req.query.status }, clock.now());
    res.json({ orders });
  });

  /**
   * @param {OrderAction} action
   * @returns {express.RequestHandler<{ id: string }>}
   */
  const transition = (action) => async (req, res) => {
    const order = await ordersService.applyAction(parseOrderId(req.params.id), action);
    res.json({ order });
  };

  router.post('/:id/start', transition('start'));
  router.post('/:id/ready', transition('ready'));
  router.post('/:id/pickup', transition('pickup'));
  router.post('/:id/cancel', transition('cancel'));

  return router;
}

module.exports = { createOrdersRouter };
