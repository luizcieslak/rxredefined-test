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

/** @type {Record<string, DbConfig>} */
module.exports = {
  development: {
    url: process.env.DATABASE_URL || DEFAULT_URL,
    dialect: 'postgres',
    // Store and read timestamps in UTC.
    timezone: '+00:00',
    logging: false,
  },
};
