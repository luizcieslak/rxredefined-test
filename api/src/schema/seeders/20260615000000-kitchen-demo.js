// @ts-check
// Idempotent: truncates and resets ids before inserting. Dates are relative to now (UTC).
//
// Expected scores at seed time (type + vip + wait + promised + complexity):
//   Bruno   dine_in VIP, prep 72 min (complexity cap)     30+20+5+0+20  = 75   preparing
//   Ana     dine_in, placed 3h ago (wait-time cap)        30+0+40+0+0   = 70   received
//   Gabi    takeout, promise 10 min overdue               20+0+20+25+0  = 65   preparing
//   Elena   delivery VIP, promised in 20 min              10+20+0+25+0  = 55   received
//   Felipe  delivery, promised in 45 min                  10+0+10+15+10 = 45   preparing
//   Lucas   dine_in, promised in 45 min (scores nothing)  30+0+5+0+0    = 35   received
//   Karin   dine_in, no promise                           30+0+5+0+0    = 35   received
//   Carla   takeout, promised in 2h                       20+0+0+0+0    = 20   received
//   Diego   takeout, promised in 3h                       20+0+0+0+0    = 20   received
//   Hugo / Iris / João: ready / picked_up / cancelled (not in the active queue)
//
// Each tied pair shares placed_at and the loser has the lower id, so only
// promised_at decides. Carla/Diego hold for ~1h (until Carla's promise scores);
// Lucas/Karin hold indefinitely since dine_in promises never score.

const TABLES = 'order_items, orders, menu_items';

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

// Inserted in this order, so ids follow it. Negative promisedInMinutes = overdue.
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

const addMinutes = (date, minutes) => new Date(date.getTime() + minutes * 60 * 1000);

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`TRUNCATE ${TABLES} RESTART IDENTITY CASCADE`, {
        transaction,
      });

      const menuRows = await queryInterface.bulkInsert('menu_items', MENU_ITEMS, {
        transaction,
        returning: ['id', 'name'],
      });
      const menuIdByName = new Map(menuRows.map((row) => [row.name, row.id]));

      const orderRows = await queryInterface.bulkInsert(
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
        { transaction, returning: ['id'] },
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

  async down(queryInterface) {
    await queryInterface.sequelize.query(`TRUNCATE ${TABLES} RESTART IDENTITY CASCADE`);
  },
};
