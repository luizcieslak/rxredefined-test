// @ts-check
// Shared by sequelize-cli and the app. Defaults match docker-compose.yml.

const DEFAULT_URL = 'postgres://kitchen_queue:kitchen_queue@localhost:5433/kitchen_queue';
// Separate database so integration tests never touch demo data.
const DEFAULT_TEST_URL = `${DEFAULT_URL}_test`;

const shared = {
  dialect: /** @type {const} */ ('postgres'),
  timezone: '+00:00', // read and write timestamps in UTC
  logging: false,
};

module.exports = {
  development: { ...shared, url: process.env.DATABASE_URL || DEFAULT_URL },
  test: { ...shared, url: process.env.TEST_DATABASE_URL || DEFAULT_TEST_URL },
};
