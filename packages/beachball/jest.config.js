// @ts-check

const { getConfigWithProjects } = require('@microsoft/beachball-scripts/config/jest');

module.exports = getConfigWithProjects(
  [
    {
      displayName: 'unit',
      testMatch: ['**/__(tests|fixtures)__/**/*.test.ts'],
    },
    {
      displayName: 'functional',
      testMatch: ['**/__functional__/**/*.test.ts'],
    },
    {
      displayName: 'e2e',
      testMatch: ['**/__e2e__/**/*.test.ts'],
    },
  ],
  {
    testTimeout: 60000,
  }
);
