// @ts-check
/** @type {Partial<import('./packages/beachball/src/types/BeachballOptions').RepoOptions>}*/
const config = {
  access: 'public',
  branch: 'v2',
  commit: false,
  disallowedChangeTypes: ['major'],
  groupChanges: true,
  ignorePatterns: ['.*ignore', '.eslintrc.js', 'jest.*.js', 'src/__*/**'],
};

module.exports = config;
