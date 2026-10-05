// @ts-check
// Allowed values are written out literally: a migration is a snapshot of the
// schema at that point in time and must not change when app constants do.

/** @type {{ up: Function, down: Function }} */
module.exports = {
  /**
   * @param {import('sequelize').QueryInterface} queryInterface
   * @param {typeof import('sequelize')} Sequelize
   */
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('menu_items', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: Sequelize.STRING, allowNull: false, unique: true },
      category: { type: Sequelize.STRING, allowNull: false },
      prep_time_minutes: { type: Sequelize.INTEGER, allowNull: false },
    });
    await queryInterface.sequelize.query(`
      ALTER TABLE menu_items
        ADD CONSTRAINT menu_items_name_not_blank CHECK (btrim(name) <> ''),
        ADD CONSTRAINT menu_items_category_valid
          CHECK (category IN ('starter', 'main_course', 'dessert', 'drink')),
        ADD CONSTRAINT menu_items_prep_time_positive CHECK (prep_time_minutes > 0);
    `);
  },

  /** @param {import('sequelize').QueryInterface} queryInterface */
  async down(queryInterface) {
    await queryInterface.dropTable('menu_items');
  },
};
