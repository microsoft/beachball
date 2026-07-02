// @ts-check

const { getGitTag, postbumpHook } = require('./scripts/beachballConfigHelpers.cjs');
const { getPublishRegistry } = require('./scripts/preparePublishRegistry.ts');

/** @type {Partial<import('./packages/beachball/src/types/BeachballOptions').RepoOptions>}*/
const config = {
  access: 'public',
  branch: 'main',
  commit: false,
  ignorePatterns: ['.*ignore', '.eslintrc.js', 'eslint.config.*', 'jest.*.js', '**/__*/**'],
  // Currently, only the publish build runs in ADO
  registry: process.env.TF_BUILD ? getPublishRegistry() : 'https://registry.npmjs.org/',

  // TODO (release): re-enable -- it has to be disabled while releasing actions separately
  groupChanges: false,
  // TODO (release): change back to major
  disallowedChangeTypes: ['prerelease'],
  // TODO (release): remove
  canaryName: 'alpha',

  getGitTag: (pkg, defaultTag) => {
    // TODO (release): use default tag for beachball
    return pkg.name === 'beachball' ? null : getGitTag(pkg, defaultTag);
  },

  hooks: {
    postbump: postbumpHook,
  },
};

module.exports = config;
