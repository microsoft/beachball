// @ts-check

const { getGitTag, postbumpHook } = require('./scripts/beachballConfigHelpers.ts');

// This config file is used for publish/canary

// TODO (release): remove canary-specific logic
const isCanary = process.argv.includes('canary');

const prereleasePackages = ['beachball', 'p-graph'];

/** @type {Partial<import('./packages/beachball/src/types/BeachballOptions').BeachballOptions>}*/
const config = {
  ...require('./beachball.config.js'),

  // TODO (release): remove
  // Separate prerelease and non-prerelease packages
  // e.g. !packages/{beachball,p-graph} for non-prerelease packages
  scope: [`${isCanary ? '' : '!'}packages/{${prereleasePackages.join(',')}}`],
  // TODO respect this for canary
  tag: isCanary ? 'next' : 'latest',
  canaryName: 'alpha',
  generateChangelog: isCanary ? false : 'md',

  // Disable fetching to ensure split publish/bump uses the same commits
  fetch: false,
  verbose: true,

  getGitTag,

  hooks: { postbump: postbumpHook },
};

module.exports = config;
