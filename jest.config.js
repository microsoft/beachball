// @ts-check
/** @type {import('@jest/types').Config.InitialProjectOptions} */
const comonOptions = {
  roots: ['<rootDir>/src'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  testEnvironment: 'node',
};

/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  reporters: ['default', 'github-actions'],
  testTimeout: 60000,
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
