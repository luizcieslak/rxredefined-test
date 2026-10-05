// Two projects so unit tests never need Postgres:
//   unit         test/*.test.js              pure modules, no database
//   integration  test/integration/**/*.test.js  real Postgres (kitchen_queue_test)
// The integration database is created by `npm run db:test:setup`, not by Jest.

/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/test/*.test.js'],
    },
    {
      displayName: 'integration',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/test/integration/**/*.test.js'],
      globalSetup: '<rootDir>/test/integration/global-setup.js',
    },
  ],
};
