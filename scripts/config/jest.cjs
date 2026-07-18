// @ts-check
const path = require('path');

/** @import { TransformOptions as BabelConfig } from '@babel/core' */
/** @import { Config } from '@jest/types' */
/** @typedef {Config.InitialProjectOptions} InitialProjectOptions */
/** @typedef {Config.InitialOptions} InitialOptions */

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
    // allowDeclareFields is only needed for `declare protected _readableState` in packages/beachball/src/__fixtures__/mockStdin.ts
    presets: [['@babel/preset-typescript', { allowDeclareFields: true }]],
  };

  if (moduleType === 'commonjs') {
    // transform import/export to CJS syntax (full @babel/preset-env isn't needed here)
    babelConfig.plugins = ['@babel/plugin-transform-modules-commonjs'];
  }

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
    // Remap ESM-style `.js` extensions in relative imports to `.ts` sources.
    // (only used in yarn plugins as of writing)
    moduleNameMapper: {
      '^(\\.{1,2}/.*)\\.js$': '$1',
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
