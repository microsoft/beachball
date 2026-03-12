// @ts-check
/** @type {Partial<import('./src/types/BeachballOptions').RepoOptions>}*/
const config = {
  disallowedChangeTypes: ['major'],
  ignorePatterns: [
    '.*ignore',
    '*.yml',
    '.claude/**/*',
    '.eslintrc.js',
    '.github/**',
    '.prettierrc.json5',
    '.vscode/**',
    'CLAUDE.md',
    'docs/**',
    'docs/.vuepress/**',
    'jest.*.js',
    'renovate.json5',
    'scripts/**',
    'src/__*/**',
    // This one is especially important (otherwise dependabot would be blocked by change file requirements)
    'yarn.lock',
    'rust/**/*',
    'go/**/*',
  ],
};

module.exports = config;
