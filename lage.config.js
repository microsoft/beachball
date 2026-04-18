// @ts-check

/** @typedef {import('lage').ConfigOptions} ConfigOptions */
/** @typedef {import('lage').CacheOptions} CacheOptions */

/**
 * Lage config (the types are slightly incorrect about what's required/optional)
 * @type {Partial<Omit<ConfigOptions, 'cacheOptions'>> & { cacheOptions?: Partial<CacheOptions> }}
 */
const config = {
  npmClient: 'yarn',
  pipeline: {
    build: {
      dependsOn: ['^build'],
      outputs: ['lib/**/*'],
    },
    lint: ['build'],
    depcheck: [],
    test: ['build'],
    'update-snapshots': ['build'],
    // For the beachball package, run the tests in order during the main test run
    'beachball#test': {
      type: 'noop',
      dependsOn: ['test:unit', 'test:func', 'test:e2e'],
    },
    // These are not typically run directly, but the dependencies enforce ordering for beachball#test
    'test:unit': ['build'],
    'test:func': ['build', 'test:unit'],
    'test:e2e': ['build', 'test:unit', 'test:func'],
  },

  cacheOptions: {
    // These are relative to the git root, and affects the hash of the cache
    // Any of these file changes will invalidate cache
    environmentGlob: [
      // Folder globs MUST end with **/* to include all files!
      '!.yarn/**/*',
      '!node_modules/**/*',
      '!**/node_modules/**/*',
      '.github/workflows/*',
      '*.js',
      '*.json',
      '*.yml',
      'yarn.lock',
    ],

    // Subset of files in package directories that will be saved into the cache.
    // (set per target instead)
    outputGlob: [],
    // outputGlob: ['lib/**/*', 'temp/*.api.md'],
  },
};

module.exports = config;
