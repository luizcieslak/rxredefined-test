// Proves the integration setup works against real Postgres and that the
// migrations enforce the data model rules (not just the app code).

const { Order, OrderItem } = require('../../src/schema/models');
const { resetDb, closeDb, createMenuItem, createOrder } = require('./helpers/db');

beforeEach(resetDb);
afterAll(closeDb);

describe('schema constraints', () => {
  test('an order with items can be stored and read back with its menu items', async () => {
    const salmon = await createMenuItem({ name: 'Grilled Salmon', prep_time_minutes: 20 });
    const order = await createOrder({}, [{ menu_item_id: salmon.get('id'), quantity: 2 }]);

    const loaded = await Order.findByPk(order.get('id'), {
      include: [{ association: 'items', include: ['menu_item'] }],
    });
    const plain = loaded.get({ plain: true });
    expect(plain.items).toHaveLength(1);
    expect(plain.items[0].quantity).toBe(2);
    expect(plain.items[0].menu_item.name).toBe('Grilled Salmon');
  });

  test('timestamps round-trip in UTC', async () => {
    const placedAt = new Date('2026-06-15T11:25:00Z');
    const order = await createOrder({ placed_at: placedAt });
    const loaded = await Order.findByPk(order.get('id'));
    expect(loaded.get('placed_at').toISOString()).toBe('2026-06-15T11:25:00.000Z');
  });

  test.each([
    ['blank customer_name', { customer_name: '   ' }],
    ['unknown type', { type: 'drive_thru' }],
    ['unknown status', { status: 'done' }],
  ])('rejects %s', async (_label, overrides) => {
    await expect(createOrder(overrides)).rejects.toThrow(/check constraint/);
  });

  test('rejects quantity 0', async () => {
    const item = await createMenuItem();
    await expect(createOrder({}, [{ menu_item_id: item.get('id'), quantity: 0 }])).rejects.toThrow(
      /order_items_quantity_positive/,
    );
  });

  test('rejects an order item for a missing menu item', async () => {
    await expect(createOrder({}, [{ menu_item_id: 999, quantity: 1 }])).rejects.toThrow(
      /foreign key/,
    );
  });

  test('deleting an order deletes its items', async () => {
    const item = await createMenuItem();
    const order = await createOrder({}, [{ menu_item_id: item.get('id'), quantity: 1 }]);
    await order.destroy();
    expect(await OrderItem.count()).toBe(0);
  });
});
