// @ts-check
/** @type {import('./src/types/BeachballOptions').RepoOptions}*/
module.exports = {
  disallowedChangeTypes: ['major'],
  ignorePatterns: [
    '.*ignore',
    '*.yml',
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
