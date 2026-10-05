// @ts-check
// Dependencies are injectable so tests can pass a frozen clock.

const express = require('express');
const repository = require('./repositories/orders');
const { createOrdersService } = require('./modules/orders');
const { createOrdersRouter } = require('./endpoints/orders');
const { notFoundHandler, errorHandler } = require('./endpoints/errors');

/** @type {import('./endpoints/orders').Clock} */
const systemClock = { now: () => new Date() };

/**
 * @param {object} [deps]
 * @param {import('./endpoints/orders').Clock} [deps.clock]
 * @param {import('./modules/orders').OrdersService} [deps.ordersService]
 */
function createApp({ clock = systemClock, ordersService = createOrdersService({ repository }) } = {}) {
  const app = express();
  app.use(express.json());
  app.use('/orders', createOrdersRouter({ ordersService, clock }));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
