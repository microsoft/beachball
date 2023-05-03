// @ts-check
/** @type {import('@jest/types').Config.InitialProjectOptions} */
const commonOptions = {
  roots: ['<rootDir>/src'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
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
      testMatch: ['**/__tests__/**/*.test.ts'],
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
