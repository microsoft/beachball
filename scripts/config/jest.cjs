// @ts-check
const path = require('path');

/** @import { TransformOptions as BabelConfig } from '@babel/core' */
/** @typedef {import('@jest/types').Config.InitialProjectOptions} InitialProjectOptions */
/** @typedef {import('@jest/types').Config.InitialOptions} InitialOptions */

/**
 * Build a `transform` entry for `babel-jest`. Babel only strips types; it does not type-check
 * (that happens in the build step).
 * @param {'commonjs' | 'es6'} moduleType Module format to emit. Pass `'es6'` for ESM packages
 *   (with `--experimental-vm-modules`); otherwise CommonJS.
 * @returns {InitialProjectOptions['transform']}
 */
function getTransform(moduleType) {
  /** @type {BabelConfig} */
  const babelConfig = {
    presets: [
      [
        '@babel/preset-env',
        {
          targets: { node: 'current' },
          modules: moduleType === 'es6' ? false : 'commonjs',
          // Preserve native `import()` so ESM-only deps (e.g. `get-port`) can be dynamically
          // imported from CJS tests; otherwise this would be rewritten to `require(...)`.
          exclude: ['proposal-dynamic-import'],
        },
      ],
      ['@babel/preset-typescript', { allowDeclareFields: true }],
    ],
  };
  return {
    '^.+\\.[cm]?ts$': ['babel-jest', babelConfig],
  };
}

/**
 * Get options that apply to individual projects, or to the top level if not using projects.
 * @param {Partial<InitialProjectOptions>} [projectOverrides] Any project options to override
 * @param {'commonjs' | 'es6'} [moduleType] Module format Babel should emit (defaults to commonjs)
 * @returns {InitialProjectOptions}
 */
function getProjectOptions(projectOverrides, moduleType = 'commonjs') {
  return {
    // This prevents having to call jest.clearAllMocks() after each test.
    // jestSetup.cjs also calls jest.restoreAllMocks() in afterAll.
    clearMocks: true,
    injectGlobals: false,
    roots: ['<rootDir>/src'],
    testPathIgnorePatterns: ['/node_modules/'],
    setupFilesAfterEnv: [path.resolve(__dirname, 'jestSetup.cjs')],
    transform: getTransform(moduleType),
    transformIgnorePatterns: ['/node_modules/'],
    watchPathIgnorePatterns: ['/node_modules/'],
    testEnvironment: 'node',
    testEnvironmentOptions: {
      // https://jestjs.io/blog/2025/06/04/jest-30#globals-cleanup-between-test-files
      globalsCleanup: 'on',
    },
    ...projectOverrides,
  };
}

/**
 * Get options that can only be applied at the top level, not per-project.
 * @returns {InitialOptions}
 */
function getTopLevelOptions() {
  return {
    injectGlobals: false,
    reporters: ['default', 'github-actions'],
    // Enable to locally test with coverage info (will only work properly with `yarn test`, not
    // `test:all` or individual projects). This would be tricky to enable in CI due to the multiple
    // test projects that run in sequence. Coverage also doesn't alone capture tricky scenarios.
    // collectCoverage: true,
    coveragePathIgnorePatterns: ['/node_modules/', '__fixtures__'],
  };
}

/**
 * Get a Jest config with multiple projects.
 * @param {InitialProjectOptions[]} projects Projects with `displayName`, `testMatch`, and any other options
 * @param {Partial<InitialOptions>} [overrides] Any top-level options to override
 * @returns {InitialOptions}
 */
function getConfigWithProjects(projects, overrides) {
  return {
    ...getTopLevelOptions(),
    projects: projects.map(project => getProjectOptions(project)),
    ...overrides,
  };
}

/**
 * Get a normal jest config (no projects).
 * @param {Partial<InitialOptions>} [overrides] Any options to override
 * @returns {InitialProjectOptions}
 */
function getConfig(overrides) {
  return {
    ...getTopLevelOptions(),
    ...getProjectOptions(),
    testMatch: ['<rootDir>/src/**/*.test.ts'],
    ...overrides,
  };
}

/**
 * Get a Jest config for ESM packages. Babel preserves ES modules; tests should be run with
 * `NODE_OPTIONS=--experimental-vm-modules` so Jest can load them.
 * @param {Partial<InitialOptions>} [overrides] Any options to override
 * @returns {InitialProjectOptions}
 */
function getESMConfig(overrides) {
  return {
    ...getTopLevelOptions(),
    ...getProjectOptions(undefined, 'es6'),
    extensionsToTreatAsEsm: ['.ts'],
    testMatch: ['<rootDir>/src/**/*.test.ts'],
    ...overrides,
  };
}

module.exports = { getConfig, getConfigWithProjects, getESMConfig };
