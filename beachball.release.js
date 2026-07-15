// @ts-check

const { getGitTag, postbumpHook } = require('./scripts/beachballConfigHelpers.cjs');
const { getPublishRegistry } = require('./scripts/preparePublishRegistry.ts');

// This config file is used for publish/canary

// TODO (release): remove canary-specific logic
const isCanary = process.argv.includes('canary');

const prereleasePackages = ['beachball', 'p-graph'];

/** @type {Partial<import('./packages/beachball/src/types/BeachballOptions').BeachballOptions>}*/
const config = {
  ...require('./beachball.config.js'),

  access: 'public',
  // TODO: update beachball to read the registry from .npmrc and/or .yarnrc.yml
  registry: getPublishRegistry(),

  // TODO (release): remove
  // Separate prerelease and non-prerelease packages
  // e.g. !packages/{beachball,p-graph} for non-prerelease packages
  scope: [`${isCanary ? '' : '!'}packages/{${prereleasePackages.join(',')}}`],
  tag: isCanary ? 'next' : 'latest',
  canaryName: 'alpha',
  gitTags: !isCanary,

  // Disable fetching to ensure split publish/bump uses the same commits
  fetch: false,
  verbose: true,

  // TODO (release): use default tag for beachball
  getGitTag: isCanary ? undefined : getGitTag,

  hooks: {
    postbump: postbumpHook,
  },
};

module.exports = config;
