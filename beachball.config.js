// @ts-check
/** @type {Partial<import('./packages/beachball/src/types/BeachballOptions').RepoOptions>}*/
const config = {
  access: 'public',
  branch: 'main',
  commit: false,
  groupChanges: true,

  // TODO (release): change back to major
  disallowedChangeTypes: ['prerelease'],
  // TODO (release): remove these
  defaultNpmTag: 'next',
  gitTags: false,
  canaryName: 'alpha',

  ignorePatterns: ['.*ignore', '.eslintrc.js', 'jest.*.js', 'src/__*/**'],
};

module.exports = config;
