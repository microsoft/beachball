// @ts-check
/** @import { BeachballConfig } from './src/index' */
/** @import { CliOptions } from './src/types/BeachballOptions' */
// TODO: fix this type ("commit" should be allowed in repo options)
/** @type {BeachballConfig & Partial<CliOptions>}*/
const config = {
  generateChangelog: true,
  ignorePatterns: [
    '.*',
    '.*/**',
    'docs/**',
    'docs/.vuepress/**',
    'eslint.config.*',
    'jest.*.js',
    'renovate.json5',
    'scripts/**',
    'src/__*/**',
    // This one is especially important (otherwise dependabot would be blocked by change file requirements)
    'yarn.lock',
  ],

  // TODO (release): change back to 'major'
  disallowedChangeTypes: ['prerelease', 'premajor', 'preminor', 'prepatch'],
  // TODO (release): remove these
  branch: 'next',
  defaultNpmTag: 'next',
  gitTags: false,
  commit: false,
};

module.exports = config;
