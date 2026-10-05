// @ts-check
// Values are written out literally: a migration is a snapshot and must not follow app constants.

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('orders', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      customer_name: { type: Sequelize.STRING, allowNull: false },
      type: { type: Sequelize.STRING, allowNull: false },
      // Sequelize.DATE is TIMESTAMP WITH TIME ZONE on Postgres.
      placed_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      promised_at: { type: Sequelize.DATE, allowNull: true },
      is_vip: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'received' },
    });
    await queryInterface.sequelize.query(`
      ALTER TABLE orders
        ADD CONSTRAINT orders_customer_name_not_blank CHECK (btrim(customer_name) <> ''),
        ADD CONSTRAINT orders_type_valid CHECK (type IN ('dine_in', 'takeout', 'delivery')),
        ADD CONSTRAINT orders_status_valid
          CHECK (status IN ('received', 'preparing', 'ready', 'picked_up', 'cancelled'));
    `);
    // The queue always filters by status.
    await queryInterface.addIndex('orders', ['status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('orders');
  },
};
