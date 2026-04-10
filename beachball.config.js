// @ts-check
/** @type {Partial<import('./src/types/BeachballOptions').RepoOptions>}*/
const config = {
  branch: 'main',
  commit: false,
  disallowedChangeTypes: ['major'],
  ignorePatterns: ['.*ignore', '.eslintrc.js', 'jest.*.js', 'src/__*/**'],
};

module.exports = config;
