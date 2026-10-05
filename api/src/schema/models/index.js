// @ts-check
// Tables come from migrations; sync() is never called.

const { Sequelize, DataTypes } = require('sequelize');
const config = require('../config');

const { url, ...options } = process.env.NODE_ENV === 'test' ? config.test : config.development;

const sequelize = new Sequelize(url, options);

const MenuItem = sequelize.define(
  'MenuItem',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
    category: { type: DataTypes.STRING, allowNull: false },
    prep_time_minutes: { type: DataTypes.INTEGER, allowNull: false },
  },
  { tableName: 'menu_items', timestamps: false },
);

const Order = sequelize.define(
  'Order',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    customer_name: { type: DataTypes.STRING, allowNull: false },
    type: { type: DataTypes.STRING, allowNull: false },
    placed_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    promised_at: { type: DataTypes.DATE, allowNull: true },
    is_vip: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'received' },
  },
  { tableName: 'orders', timestamps: false },
);

const OrderItem = sequelize.define(
  'OrderItem',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    order_id: { type: DataTypes.INTEGER, allowNull: false },
    menu_item_id: { type: DataTypes.INTEGER, allowNull: false },
    quantity: { type: DataTypes.INTEGER, allowNull: false },
  },
  { tableName: 'order_items', timestamps: false },
);

Order.hasMany(OrderItem, { as: 'items', foreignKey: 'order_id' });
OrderItem.belongsTo(Order, { as: 'order', foreignKey: 'order_id' });
OrderItem.belongsTo(MenuItem, { as: 'menu_item', foreignKey: 'menu_item_id' });

module.exports = { sequelize, MenuItem, Order, OrderItem };
