// @ts-check

// NOTE: Release-specific settings are in beachball.release.js
// (this isn't strictly necessary for all settings, but some cause conflicts)

/** @type {Partial<import('./packages/beachball/src/types/BeachballOptions').RepoOptions>}*/
const config = {
  branch: 'main',
  commit: false,
  ignorePatterns: ['.*', 'eslint.config.*', 'jest.config.*', '**/__*/**'],

  // TODO (release): re-enable -- it has to be disabled while releasing actions separately
  groupChanges: false,
  // TODO (release): change back to major
  disallowedChangeTypes: ['prerelease'],
};

module.exports = config;
