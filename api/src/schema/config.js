// @ts-check
// Database connection settings, shared by sequelize-cli and the running app.
// Defaults match docker-compose.yml (host port 5433).

/**
 * @typedef {object} DbConfig
 * @property {string} url
 * @property {'postgres'} dialect
 * @property {string} timezone
 * @property {false} logging
 */

const DEFAULT_URL = 'postgres://kitchen_queue:kitchen_queue@localhost:5433/kitchen_queue';
// Same server, separate database, so integration tests never touch demo data.
const DEFAULT_TEST_URL = `${DEFAULT_URL}_test`;

/** @type {Omit<DbConfig, 'url'>} */
const shared = {
  dialect: 'postgres',
  // Store and read timestamps in UTC.
  timezone: '+00:00',
  logging: false,
};

/** @type {Record<string, DbConfig>} */
module.exports = {
  development: { ...shared, url: process.env.DATABASE_URL || DEFAULT_URL },
  test: { ...shared, url: process.env.TEST_DATABASE_URL || DEFAULT_TEST_URL },
};
