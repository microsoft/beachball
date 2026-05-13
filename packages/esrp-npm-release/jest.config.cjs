// @ts-check
const { getConfig } = require('@microsoft/beachball-scripts/config/jest.cjs');

module.exports = getConfig({
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  // ESM support: this package is `type: module` and source uses `.ts` extensions in imports.
  // Override the default ts-jest transform to enable ESM mode using a test-specific tsconfig.
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true, tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  // Additional extensions to treat as ESM (does not override defaults)
  extensionsToTreatAsEsm: ['.ts', '.tsx', '.mts'],
});
