// @ts-check
const { getESMConfig } = require('@microsoft/beachball-scripts/config/jest.cjs');

module.exports = getESMConfig({
  roots: ['<rootDir>/scripts'],
  testMatch: ['<rootDir>/scripts/**/*.test.ts'],
});
