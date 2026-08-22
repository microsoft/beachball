// @ts-check
/** @type {import('./packages/beachball/src/index').BeachballConfig}*/
const config = {
  branch: 'v2',
  commit: false,
  disallowedChangeTypes: ['major'],
  ignorePatterns: ['.*ignore', '.eslintrc.js', 'jest.*.js', 'src/__*/**/*'],
  // NOTE: beachball no longer controls the npm dist-tag (see .ado/release.yml)
};

module.exports = config;
