// @ts-check
/** @type {import('./src/types/BeachballOptions').RepoOptions}*/
module.exports = {
  disallowedChangeTypes: ['major'],
  ignorePatterns: [
    '.*ignore',
    '.github/**',
    '.prettierrc',
    '.vscode/**',
    'docs/**',
    'jest.*.js',
    'src/__e2e__/**',
    'src/__tests__/**',
    'src/fixtures/**',
    // This one is especially important (otherwise dependabot would be blocked by change file requirements)
    'yarn.lock',
  ],
};
