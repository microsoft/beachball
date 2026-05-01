// @ts-check
/** @type {Partial<import('./packages/beachball/src/types/BeachballOptions').RepoOptions>}*/
const config = {
  access: 'public',
  branch: 'main',
  commit: false,
  groupChanges: true,
  ignorePatterns: ['.*ignore', '.eslintrc.js', 'jest.*.js', 'src/__*/**'],
  // TODO (release): change back to major
  disallowedChangeTypes: ['prerelease'],
  // TODO (release): remove
  canaryName: 'alpha',
};

module.exports = config;
