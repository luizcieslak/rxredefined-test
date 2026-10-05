// End-to-end through Express, the module, the repository and real Postgres.
// The app gets a frozen clock, so scores are deterministic.

const request = require('supertest');
const { createApp } = require('../../src/app');
const { Order } = require('../../src/schema/models');
const { resetDb, closeDb, createMenuItem, createOrder } = require('./helpers/db');

const NOW = new Date('2026-06-15T12:00:00Z');
const app = createApp({ clock: { now: () => NOW } });

const minutesAgo = (m) => new Date(NOW.getTime() - m * 60 * 1000);
const minutesFromNow = (m) => new Date(NOW.getTime() + m * 60 * 1000);

let salmon;
let caesar;
let pizza;

beforeEach(async () => {
  await resetDb();
  salmon = await createMenuItem({ name: 'Grilled Salmon', prep_time_minutes: 20 });
  caesar = await createMenuItem({ name: 'Caesar Salad', prep_time_minutes: 10 });
  pizza = await createMenuItem({ name: 'Margherita Pizza', prep_time_minutes: 12 });
});

afterAll(closeDb);

/** @param {Record<string, unknown>} [overrides] */
const orderWithPizza = (overrides = {}) =>
  createOrder(overrides, [{ menu_item_id: pizza.get('id'), quantity: 1 }]);

const statusOf = async (id) => (await Order.findByPk(id)).get('status');

describe('GET /orders/queue', () => {
  test('returns the spec examples ranked and scored with the frozen clock', async () => {
    // Example A (spec 5.3)
    const a = await createOrder({ customer_name: 'A', type: 'dine_in', placed_at: minutesAgo(35) }, [
      { menu_item_id: salmon.get('id'), quantity: 2 },
      { menu_item_id: caesar.get('id'), quantity: 1 },
    ]);
    // Example B (spec 5.3)
    const b = await orderWithPizza({
      customer_name: 'B',
      type: 'delivery',
      is_vip: true,
      placed_at: minutesAgo(10),
      promised_at: minutesFromNow(20),
    });

    const res = await request(app).get('/orders/queue').expect(200);

    expect(res.body.orders.map((o) => [o.id, o.score])).toEqual([
      [b.get('id'), 60],
      [a.get('id'), 60],
    ]);
    expect(res.body.orders[1]).toMatchObject({
      customer_name: 'A',
      type: 'dine_in',
      is_vip: false,
      status: 'received',
      placed_at: '2026-06-15T11:25:00.000Z',
      promised_at: null,
      minutes_waiting: 35,
      allowed_actions: ['start', 'cancel'],
      items: [
        { name: 'Grilled Salmon', quantity: 2 },
        { name: 'Caesar Salad', quantity: 1 },
      ],
    });
  });

  test('default queue holds only received and preparing orders', async () => {
    const received = await orderWithPizza({ status: 'received' });
    const preparing = await orderWithPizza({ status: 'preparing' });
    await orderWithPizza({ status: 'ready' });
    await orderWithPizza({ status: 'picked_up' });
    await orderWithPizza({ status: 'cancelled' });

    const res = await request(app).get('/orders/queue').expect(200);

    expect(res.body.orders.map((o) => o.id).sort()).toEqual(
      [received.get('id'), preparing.get('id')].sort(),
    );
  });

  test('a cancelled or picked-up order leaves the default queue', async () => {
    const toCancel = await orderWithPizza({ status: 'received' });
    const toPickUp = await orderWithPizza({ status: 'ready' });
    const stays = await orderWithPizza({ status: 'received' });

    await request(app).post(`/orders/${toCancel.get('id')}/cancel`).expect(200);
    await request(app).post(`/orders/${toPickUp.get('id')}/pickup`).expect(200);

    const res = await request(app).get('/orders/queue').expect(200);
    expect(res.body.orders.map((o) => o.id)).toEqual([stays.get('id')]);
  });

  test.each(['received', 'preparing'])('?status=%s filters to that status', async (status) => {
    await orderWithPizza({ status: 'received' });
    await orderWithPizza({ status: 'preparing' });

    const res = await request(app).get('/orders/queue').query({ status }).expect(200);

    expect(res.body.orders).toHaveLength(1);
    expect(res.body.orders[0].status).toBe(status);
  });

  test.each([
    ['a status outside the active queue', '?status=ready'],
    ['an unknown status', '?status=foo'],
    ['an empty status', '?status='],
    ['a repeated status', '?status=received&status=preparing'],
  ])('rejects %s with 400 INVALID_STATUS_FILTER', async (_label, query) => {
    const res = await request(app).get(`/orders/queue${query}`).expect(400);
    expect(res.body.error.code).toBe('INVALID_STATUS_FILTER');
  });

  test('empty queue returns an empty list', async () => {
    const res = await request(app).get('/orders/queue').expect(200);
    expect(res.body).toEqual({ orders: [] });
  });
});

describe('POST /orders/:id/{action}', () => {
  test.each([
    ['start', 'received', 'preparing', ['ready']],
    ['cancel', 'received', 'cancelled', []],
    ['ready', 'preparing', 'ready', ['pickup']],
    ['pickup', 'ready', 'picked_up', []],
  ])('%s moves %s -> %s', async (action, from, to, nextActions) => {
    const order = await orderWithPizza({ status: from });

    const res = await request(app).post(`/orders/${order.get('id')}/${action}`).expect(200);

    expect(res.body.order).toMatchObject({ id: order.get('id'), status: to, allowed_actions: nextActions });
    expect(await statusOf(order.get('id'))).toBe(to);
  });

  test.each([
    ['start an order that is already preparing (repeat)', 'start', 'preparing'],
    ['ready a received order (skip a step)', 'ready', 'received'],
    ['pickup a received order (skip two steps)', 'pickup', 'received'],
    ['cancel a preparing order', 'cancel', 'preparing'],
    ['start a cancelled order (terminal)', 'start', 'cancelled'],
    ['cancel a picked-up order (terminal)', 'cancel', 'picked_up'],
  ])('rejects: %s -> 409 INVALID_TRANSITION, status unchanged', async (_label, action, from) => {
    const order = await orderWithPizza({ status: from });

    const res = await request(app).post(`/orders/${order.get('id')}/${action}`).expect(409);

    expect(res.body.error).toMatchObject({ code: 'INVALID_TRANSITION', details: { from } });
    expect(res.body.error.message).toEqual(expect.any(String));
    expect(await statusOf(order.get('id'))).toBe(from);
  });

  test('two concurrent starts: exactly one wins, the other gets 409', async () => {
    const order = await orderWithPizza({ status: 'received' });
    const url = `/orders/${order.get('id')}/start`;

    const results = await Promise.all([request(app).post(url), request(app).post(url)]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await statusOf(order.get('id'))).toBe('preparing');
  });

  test('unknown order -> 404 ORDER_NOT_FOUND', async () => {
    const res = await request(app).post('/orders/999999/start').expect(404);
    expect(res.body.error.code).toBe('ORDER_NOT_FOUND');
  });

  test.each(['abc', '0', '-1', '1.5', '99999999999'])(
    'malformed id %s -> 400 INVALID_ORDER_ID',
    async (id) => {
      const res = await request(app).post(`/orders/${id}/start`).expect(400);
      expect(res.body.error.code).toBe('INVALID_ORDER_ID');
    },
  );
});

describe('routing and errors', () => {
  test('unknown route -> 404 ROUTE_NOT_FOUND', async () => {
    const res = await request(app).post('/orders/1/teleport').expect(404);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
  });

  test('malformed JSON body -> 400 INVALID_JSON', async () => {
    const order = await orderWithPizza();
    const res = await request(app)
      .post(`/orders/${order.get('id')}/start`)
      .set('Content-Type', 'application/json')
      .send('{not json')
      .expect(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });
});
