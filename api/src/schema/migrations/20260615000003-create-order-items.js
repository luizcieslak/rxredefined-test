// @ts-check

/** @type {{ up: Function, down: Function }} */
module.exports = {
  /**
   * @param {import('sequelize').QueryInterface} queryInterface
   * @param {typeof import('sequelize')} Sequelize
   */
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('order_items', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      order_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'orders', key: 'id' },
        onDelete: 'CASCADE',
      },
      menu_item_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'menu_items', key: 'id' },
        onDelete: 'RESTRICT',
      },
      quantity: { type: Sequelize.INTEGER, allowNull: false },
    });
    await queryInterface.sequelize.query(`
      ALTER TABLE order_items
        ADD CONSTRAINT order_items_quantity_positive CHECK (quantity > 0);
    `);
    await queryInterface.addIndex('order_items', ['order_id']);
  },

  /** @param {import('sequelize').QueryInterface} queryInterface */
  async down(queryInterface) {
    await queryInterface.dropTable('order_items');
  },
};
