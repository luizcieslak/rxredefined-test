// @ts-check
// Helpers shared by integration tests: reset tables between tests and insert
// small fixtures. Tests never use the demo seed.

const { sequelize, MenuItem, Order, OrderItem } = require('../../../src/schema/models');

const TABLES = 'order_items, orders, menu_items';

/** Guard so a misconfigured env can never truncate the dev database. */
function assertTestDatabase() {
  const name = sequelize.getDatabaseName();
  if (!name.endsWith('_test')) {
    throw new Error(`Refusing to reset non-test database "${name}"`);
  }
}

async function resetDb() {
  assertTestDatabase();
  await sequelize.query(`TRUNCATE ${TABLES} RESTART IDENTITY CASCADE`);
}

async function closeDb() {
  await sequelize.close();
}

/**
 * @param {Partial<{ name: string, category: string, prep_time_minutes: number }>} [overrides]
 */
async function createMenuItem(overrides = {}) {
  return MenuItem.create({
    name: `Item ${Math.random().toString(36).slice(2, 8)}`,
    category: 'main_course',
    prep_time_minutes: 10,
    ...overrides,
  });
}

/**
 * Creates an order and its items in one go.
 * @param {Record<string, unknown>} [overrides] Order columns.
 * @param {Array<{ menu_item_id: number, quantity: number }>} [items]
 */
async function createOrder(overrides = {}, items = []) {
  const order = await Order.create({
    customer_name: 'Test Customer',
    type: 'dine_in',
    is_vip: false,
    status: 'received',
    placed_at: new Date('2026-06-15T11:30:00Z'),
    promised_at: null,
    ...overrides,
  });
  for (const item of items) {
    await OrderItem.create({ ...item, order_id: order.get('id') });
  }
  return order;
}

module.exports = { sequelize, resetDb, closeDb, createMenuItem, createOrder };
