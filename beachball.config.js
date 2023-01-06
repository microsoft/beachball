// @ts-check
/** @type {import('./src/types/BeachballOptions').RepoOptions}*/
module.exports = {
  disallowedChangeTypes: ['major'],
  ignorePatterns: [
    '.*ignore',
    '.github/**',
    '.prettierrc.json5',
    '.vscode/**',
    'docs/**',
    'jest.*.js',
    'renovate.json5',
    'src/__*/**',
    // This one is especially important (otherwise dependabot would be blocked by change file requirements)
    'yarn.lock',
  ],
};
