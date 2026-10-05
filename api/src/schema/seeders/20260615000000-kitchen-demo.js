// @ts-check
// Demo data for the Kitchen Display.
//
// Idempotent: every run truncates the three tables (and resets their ids)
// before inserting, so running it twice gives the same rows. All dates are
// relative to the moment the seed runs, in UTC, so the demo never goes stale.
//
// Expected scores at seed time (type + vip + wait + promised + complexity):
//   Bruno   dine_in VIP, prep 72 min (complexity cap)     30+20+5+0+20  = 75   preparing
//   Ana     dine_in, placed 3h ago (wait-time cap)        30+0+40+0+0   = 70   received
//   Gabi    takeout, promise 10 min overdue               20+0+20+25+0  = 65   preparing
//   Elena   delivery VIP, promised in 20 min              10+20+0+25+0  = 55   received
//   Felipe  delivery, promised in 45 min                  10+0+10+15+10 = 45   preparing
//   Carla   takeout, promised in 2h                       20+0+0+0+0    = 20   received
//   Diego   takeout, promised in 3h                       20+0+0+0+0    = 20   received
//   Lucas   dine_in, promised in 45 min (scores nothing)  30+0+5+0+0    = 35   received
//   Karin   dine_in, no promise                           30+0+5+0+0    = 35   received
//   Hugo / Iris / João: ready / picked_up / cancelled (not in the active queue)
//
// Carla and Diego tie on score. They share placed_at and Diego has the lower
// id, so only promised_at can put Carla first. Both promises are > 60 minutes
// out, so the tie holds for about an hour after seeding; after that Carla's
// promise starts adding points and she stays ahead anyway.
//
// Lucas and Karin show the dine_in rule: a dine_in promise earns no points but
// wins the tie-break over a null promise. They share placed_at and items and
// Karin has the lower id, so only Lucas's promise can put him first. Because
// the promise never adds points, this tie holds for as long as the demo runs.

const TABLES = 'order_items, orders, menu_items';

/** @type {Array<{ name: string, category: string, prep_time_minutes: number }>} */
const MENU_ITEMS = [
  { name: 'Caesar Salad', category: 'starter', prep_time_minutes: 10 },
  { name: 'Garlic Bread', category: 'starter', prep_time_minutes: 6 },
  { name: 'Tomato Soup', category: 'starter', prep_time_minutes: 8 },
  { name: 'Grilled Salmon', category: 'main_course', prep_time_minutes: 20 },
  { name: 'Margherita Pizza', category: 'main_course', prep_time_minutes: 12 },
  { name: 'Ribeye Steak', category: 'main_course', prep_time_minutes: 25 },
  { name: 'Mushroom Risotto', category: 'main_course', prep_time_minutes: 22 },
  { name: 'Chicken Burger', category: 'main_course', prep_time_minutes: 15 },
  { name: 'Tiramisu', category: 'dessert', prep_time_minutes: 5 },
  { name: 'Chocolate Lava Cake', category: 'dessert', prep_time_minutes: 14 },
  { name: 'Lemonade', category: 'drink', prep_time_minutes: 2 },
  { name: 'Espresso', category: 'drink', prep_time_minutes: 1 },
];

/**
 * @typedef {object} SeedOrder
 * @property {string} customer_name
 * @property {'dine_in' | 'takeout' | 'delivery'} type
 * @property {boolean} is_vip
 * @property {string} status
 * @property {number} placedMinutesAgo
 * @property {number | null} promisedInMinutes Negative means overdue.
 * @property {Array<[string, number]>} items [menu item name, quantity]
 */

/** @type {SeedOrder[]} Inserted in this order, so ids follow it. */
const ORDERS = [
  {
    customer_name: 'Ana Souza', type: 'dine_in', is_vip: false, status: 'received',
    placedMinutesAgo: 180, promisedInMinutes: null,
    items: [['Caesar Salad', 1]],
  },
  {
    customer_name: 'Bruno Lima', type: 'dine_in', is_vip: true, status: 'preparing',
    placedMinutesAgo: 12, promisedInMinutes: null,
    items: [['Ribeye Steak', 2], ['Mushroom Risotto', 1]],
  },
  {
    customer_name: 'Diego Rocha', type: 'takeout', is_vip: false, status: 'received',
    placedMinutesAgo: 5, promisedInMinutes: 180,
    items: [['Margherita Pizza', 1]],
  },
  {
    customer_name: 'Carla Mendes', type: 'takeout', is_vip: false, status: 'received',
    placedMinutesAgo: 5, promisedInMinutes: 120,
    items: [['Margherita Pizza', 1]],
  },
  {
    customer_name: 'Elena Costa', type: 'delivery', is_vip: true, status: 'received',
    placedMinutesAgo: 8, promisedInMinutes: 20,
    items: [['Margherita Pizza', 1], ['Lemonade', 1]],
  },
  {
    customer_name: 'Felipe Alves', type: 'delivery', is_vip: false, status: 'preparing',
    placedMinutesAgo: 25, promisedInMinutes: 45,
    items: [['Chicken Burger', 2]],
  },
  {
    customer_name: 'Gabi Martins', type: 'takeout', is_vip: false, status: 'preparing',
    placedMinutesAgo: 40, promisedInMinutes: -10,
    items: [['Garlic Bread', 1], ['Tiramisu', 1]],
  },
  {
    customer_name: 'Hugo Pereira', type: 'dine_in', is_vip: false, status: 'ready',
    placedMinutesAgo: 30, promisedInMinutes: null,
    items: [['Grilled Salmon', 1], ['Espresso', 2]],
  },
  {
    customer_name: 'Iris Nunes', type: 'takeout', is_vip: false, status: 'picked_up',
    placedMinutesAgo: 90, promisedInMinutes: -45,
    items: [['Tomato Soup', 1], ['Chocolate Lava Cake', 1]],
  },
  {
    customer_name: 'João Ribeiro', type: 'delivery', is_vip: true, status: 'cancelled',
    placedMinutesAgo: 50, promisedInMinutes: -5,
    items: [['Chicken Burger', 1]],
  },
  {
    customer_name: 'Karin Duarte', type: 'dine_in', is_vip: false, status: 'received',
    placedMinutesAgo: 15, promisedInMinutes: null,
    items: [['Tomato Soup', 1]],
  },
  {
    customer_name: 'Lucas Ferreira', type: 'dine_in', is_vip: false, status: 'received',
    placedMinutesAgo: 15, promisedInMinutes: 45,
    items: [['Tomato Soup', 1]],
  },
];

/**
 * @param {Date} now
 * @param {number} minutes
 * @returns {Date}
 */
function addMinutes(now, minutes) {
  return new Date(now.getTime() + minutes * 60 * 1000);
}

/**
 * bulkInsert options asking Postgres to return the inserted rows. `returning`
 * works at runtime but is missing from Sequelize's QueryOptions typings.
 * @param {import('sequelize').Transaction} transaction
 * @param {string[]} columns
 * @returns {import('sequelize').QueryOptions}
 */
function insertReturning(transaction, columns) {
  return /** @type {import('sequelize').QueryOptions} */ ({ transaction, returning: columns });
}

/** @type {{ up: Function, down: Function }} */
module.exports = {
  /** @param {import('sequelize').QueryInterface} queryInterface */
  async up(queryInterface) {
    const now = new Date();

    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`TRUNCATE ${TABLES} RESTART IDENTITY CASCADE`, {
        transaction,
      });

      const menuRows = /** @type {Array<{ id: number, name: string }>} */ (
        /** @type {unknown} */ (
          await queryInterface.bulkInsert(
            'menu_items',
            MENU_ITEMS,
            insertReturning(transaction, ['id', 'name']),
          )
        )
      );
      const menuIdByName = new Map(menuRows.map((row) => [row.name, row.id]));

      const orderRows = /** @type {Array<{ id: number }>} */ (
        /** @type {unknown} */ (
          await queryInterface.bulkInsert(
            'orders',
            ORDERS.map((order) => ({
              customer_name: order.customer_name,
              type: order.type,
              is_vip: order.is_vip,
              status: order.status,
              placed_at: addMinutes(now, -order.placedMinutesAgo),
              promised_at:
                order.promisedInMinutes === null ? null : addMinutes(now, order.promisedInMinutes),
            })),
            insertReturning(transaction, ['id']),
          )
        )
      );

      const itemRows = ORDERS.flatMap((order, index) =>
        order.items.map(([name, quantity]) => {
          const menuItemId = menuIdByName.get(name);
          if (menuItemId === undefined) throw new Error(`Seed references unknown menu item: ${name}`);
          return { order_id: orderRows[index].id, menu_item_id: menuItemId, quantity };
        }),
      );
      await queryInterface.bulkInsert('order_items', itemRows, { transaction });
    });
  },

  /** @param {import('sequelize').QueryInterface} queryInterface */
  async down(queryInterface) {
    await queryInterface.sequelize.query(`TRUNCATE ${TABLES} RESTART IDENTITY CASCADE`);
  },
};
