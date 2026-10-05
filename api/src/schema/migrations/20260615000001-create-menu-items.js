// @ts-check
// Values are written out literally: a migration is a snapshot and must not follow app constants.

module.exports = {
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

  async down(queryInterface) {
    await queryInterface.dropTable('menu_items');
  },
};
