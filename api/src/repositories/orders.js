// @ts-check
// Returns plain objects so modules never see Sequelize instances.

const { Order, OrderItem, MenuItem } = require('../schema/models');

/**
 * @typedef {object} OrderItemRecord
 * @property {number} menu_item_id
 * @property {string} name
 * @property {number} quantity
 * @property {number} prep_time_minutes
 */

/**
 * @typedef {object} OrderRecord
 * @property {number} id
 * @property {string} customer_name
 * @property {import('../modules/priority').OrderType} type
 * @property {boolean} is_vip
 * @property {import('../modules/transitions').OrderStatus} status
 * @property {Date} placed_at
 * @property {Date | null} promised_at
 * @property {OrderItemRecord[]} items
 */

const WITH_ITEMS = {
  include: [
    {
      model: OrderItem,
      as: 'items',
      include: [{ model: MenuItem, as: 'menu_item' }],
    },
  ],
  // Stable item order for the items summary.
  order: /** @type {import('sequelize').Order} */ ([[{ model: OrderItem, as: 'items' }, 'id', 'ASC']]),
};

/**
 * @param {import('sequelize').Model} row
 * @returns {OrderRecord}
 */
function toRecord(row) {
  const order = row.get({ plain: true });
  return {
    id: order.id,
    customer_name: order.customer_name,
    type: order.type,
    is_vip: order.is_vip,
    status: order.status,
    placed_at: order.placed_at,
    promised_at: order.promised_at,
    items: order.items.map((/** @type {any} */ item) => ({
      menu_item_id: item.menu_item_id,
      name: item.menu_item.name,
      quantity: item.quantity,
      prep_time_minutes: item.menu_item.prep_time_minutes,
    })),
  };
}

/**
 * Unsorted: ranking is the priority module's job.
 * @param {readonly string[]} statuses
 * @returns {Promise<OrderRecord[]>}
 */
async function findByStatuses(statuses) {
  const rows = await Order.findAll({ ...WITH_ITEMS, where: { status: [...statuses] } });
  return rows.map(toRecord);
}

/**
 * @param {number} id
 * @returns {Promise<OrderRecord | null>}
 */
async function findById(id) {
  const row = await Order.findByPk(id, WITH_ITEMS);
  return row ? toRecord(row) : null;
}

/**
 * Compare-and-set, so two concurrent requests cannot both leave `fromStatus`.
 * @param {number} id
 * @param {string} fromStatus
 * @param {string} toStatus
 * @returns {Promise<boolean>} true if the row was updated.
 */
async function updateStatusIfCurrent(id, fromStatus, toStatus) {
  const [affected] = await Order.update({ status: toStatus }, { where: { id, status: fromStatus } });
  return affected === 1;
}

module.exports = { findByStatuses, findById, updateStatusIfCurrent };
