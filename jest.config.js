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
  // Enable to locally test with coverage info (will only work properly with `yarn test`, not
  // `test:all` or individual projects). This would be tricky to enable in CI due to the multiple
  // test projects that run in sequence. Coverage also doesn't alone capture tricky scenarios.
  // collectCoverage: true,
  coveragePathIgnorePatterns: ['/node_modules/', '__fixtures__'],
  coverageThreshold: {
    global: { branches: 80, functions: 100, lines: 90, statements: 90 },
  },
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
