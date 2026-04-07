// @ts-check
/** @type {Partial<import('./src/types/BeachballOptions').RepoOptions>}*/
const config = {
  branch: 'main',
  commit: false,
  disallowedChangeTypes: ['major'],
  ignorePatterns: [
    '.*ignore',
    '*.yml',
    'CLAUDE.md',
    '.claude/**',
    '.claude-plugin/**',
    '.eslintrc.js',
    '.github/**',
    '.prettierrc.json5',
    '.vscode/**',
    'docs/**',
    'docs/.vuepress/**',
    'jest.*.js',
    'renovate.json5',
    'scripts/**',
    'src/__*/**',
    // This one is especially important (otherwise dependabot would be blocked by change file requirements)
    'yarn.lock',
  ],
};

module.exports = config;
