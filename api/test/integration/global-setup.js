// @ts-check
// Only checks the test database is ready; `npm run db:test:setup` prepares it.

const fs = require('node:fs');
const path = require('node:path');
const { Sequelize } = require('sequelize');
const config = require('../../src/schema/config');

const MIGRATIONS_DIR = path.resolve(__dirname, '../../src/schema/migrations');
const HINT = 'Run `npm run db:test:setup` (with `docker compose up -d`) first.';

module.exports = async function globalSetup() {
  const { url, ...options } = config.test;
  const sequelize = new Sequelize(url, options);
  try {
    const [rows] = await sequelize.query('SELECT name FROM "SequelizeMeta"');
    const applied = new Set(/** @type {Array<{ name: string }>} */ (rows).map((row) => row.name));
    const pending = fs.readdirSync(MIGRATIONS_DIR).filter((file) => !applied.has(file));
    if (pending.length > 0) {
      throw new Error(`Test database has pending migrations: ${pending.join(', ')}. ${HINT}`);
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Integration test database is not ready (${reason}). ${HINT}`);
  } finally {
    await sequelize.close();
  }
};
