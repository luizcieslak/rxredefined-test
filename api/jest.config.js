// unit: no database. integration: real Postgres, prepared by `npm run db:test:setup`.

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
