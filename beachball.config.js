// @ts-check
/** @type {Partial<import('./src/types/BeachballOptions').RepoOptions>} */
const config = {
  ignorePatterns: [
    '.*',
    '.*/**',
    '*.yml',
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
};

module.exports = config;
