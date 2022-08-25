// @ts-check
/** @type {import('@jest/types').Config.InitialOptions} */
const comonOptions = {
  roots: ['<rootDir>/src'],
  reporters: ['default', 'github-actions'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  testEnvironment: 'node',
  testTimeout: 60000,
};

/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  projects: [
    {
      displayName: 'unit',
      testMatch: ['**/__tests__/**/*.test.ts'],
      ...comonOptions,
    },
    {
      displayName: 'functional',
      testMatch: ['**/__functional__/**/*.test.ts'],
      ...comonOptions,
    },
    {
      displayName: 'e2e',
      testMatch: ['**/__e2e__/**/*.test.ts'],
      ...comonOptions,
    },
  ],
};
