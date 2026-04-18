// @ts-check
const path = require('path');

/** @typedef {import('@jest/types').Config.InitialProjectOptions} InitialProjectOptions */
/** @typedef {import('@jest/types').Config.InitialOptions} InitialOptions */

/**
 * Get options that apply to individual projects, or to the top level if not using projects.
 * @param {Partial<InitialProjectOptions>} [projectOverrides] Any project options to override
 * @returns {InitialProjectOptions}
 */
function getProjectOptions(projectOverrides) {
  return {
    injectGlobals: false,
    roots: ['<rootDir>/src'],
    setupFilesAfterEnv: [path.resolve(__dirname, 'jestSetup.js')],
    transform: {
      '^.+\\.tsx?$': [
        'ts-jest',
        // in ts-jest, this means skip type checking (we already type check in the build step)
        { isolatedModules: true },
      ],
    },
    testEnvironment: 'node',
    ...projectOverrides,
  };
}

/**
 * Get options that can only be applied at the top level, not per-project.
 * @returns {InitialOptions}
 */
function getTopLevelOptions() {
  return {
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
    testMatch: ['src/**/*.test.ts'],
    ...overrides,
  };
}

module.exports = { getConfig, getConfigWithProjects };
