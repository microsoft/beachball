// @ts-check
/** @type {Partial<import('./packages/beachball/src/types/BeachballOptions').RepoOptions>}*/
const config = {
  branch: 'main',
  commit: false,
  disallowedChangeTypes: ['major'],
  groupChanges: true,
  ignorePatterns: ['.*ignore', '.eslintrc.js', 'jest.*.js', 'src/__*/**'],
};

module.exports = config;
