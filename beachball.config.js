// @ts-check
/** @type {Partial<import('./src/types/BeachballOptions').RepoOptions>} */
const config = {
  // TODO (release): change back to 'main'
  branch: 'next',
  commit: false,
  // TODO (release): change back to 'major'
  disallowedChangeTypes: ['prerelease', 'premajor', 'preminor', 'prepatch'],

  // TODO (release): remove these
  defaultNpmTag: 'next',
  gitTags: false,

  ignorePatterns: [
    '.*',
    '.*/**',
    '*.yml',
    'CLAUDE.md',
    '.claude/**',
    '.claude-plugin/**',
    '.eslintrc.js',
    '.github/**',
    '.prettierrc.json5',
    '.vscode/**',
    'docs/**',
    'docs/.*/**',
    'docs/.*',
    'jest.*.js',
    'renovate.json5',
    'scripts/**',
    'src/__*/**',
    // This one is especially important (otherwise dependabot would be blocked by change file requirements)
    'yarn.lock',
  ],
};

module.exports = config;
