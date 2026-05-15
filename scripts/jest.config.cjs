//
// This is the jest config for the SCRIPTS PACKAGE, not to be shared
//
const { getESMConfig } = require('./config/jest.cjs');

module.exports = getESMConfig({
  roots: ['<rootDir>'],
  testMatch: ['<rootDir>/**/*.test.ts'],
});
