// @ts-check
/** @type {import('@jest/types').Config.InitialProjectOptions} */
const commonOptions = {
  injectGlobals: false,
  roots: ['<rootDir>/src'],
  setupFilesAfterEnv: ['<rootDir>/scripts/jestSetup.js'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      // in ts-jest, this means skip type checking (we already type check in the build step)
      { isolatedModules: true },
    ],
  },
  testEnvironment: 'node',
};

/** @type {import('@jest/types').Config.InitialOptions} */
const config = {
  reporters: ['default', 'github-actions'],
  testTimeout: 60000,
  projects: [
    {
      displayName: 'unit',
      testMatch: ['**/__(tests|fixtures)__/**/*.test.ts'],
      ...commonOptions,
    },
    {
      displayName: 'functional',
      testMatch: ['**/__functional__/**/*.test.ts'],
      ...commonOptions,
    },
    {
      displayName: 'e2e',
      testMatch: ['**/__e2e__/**/*.test.ts'],
      ...commonOptions,
    },
  ],
};
module.exports = config;
