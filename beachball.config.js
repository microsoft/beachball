// @ts-check
/** @type {import('./src/types/BeachballOptions').RepoOptions}*/
module.exports = {
  ignorePatterns: [
    '.*',
    '.*/**',
    'docs/**',
    'docs/.vuepress/**',
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
