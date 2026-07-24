import path from 'node:path';
import { getToken } from './checkToken.ts';
import { getServerConfigExtends } from './utils/extends.ts';
import { defaultBranch, defaultRepo, githubBranchName, isPullRequest } from './utils/github.ts';
import { readPresets } from './utils/readPresets.ts';

// Force an "extends" config with most or all presets from this repo. The basic validation step or
// runs on main can use all presets, but full renovate dry runs in a PR must omit any presets which
// reference other local presets (see getServerConfigExtends comment).
const presets = readPresets();
const isBasicValidate = process.argv.some(arg => path.basename(arg).startsWith('renovate-config-validator'));
const extnds =
  isBasicValidate || !githubBranchName || githubBranchName === defaultBranch
    ? getServerConfigExtends(presets)
    : getServerConfigExtends(presets, githubBranchName);

/**
 * Renovate self-hosted (server) config for testPresetsFull.ts
 * https://docs.renovatebot.com/self-hosted-configuration/
 *
 * (types are exported from `renovate/dist/config/types.js` but the explicit renovate dep was
 * removed to decrease maintenance overhead)
 */
const config = {
  // All we really need here is the config validation, so do the shortest type of dry run
  // https://docs.renovatebot.com/self-hosted-configuration/#dryrun
  dryRun: 'extract',
  repositories: [defaultRepo],
  hostRules: [{ abortOnError: true }],
  username: 'fake-user-do-not-match-prs',
  // For the basic config test to pass, the token must be a string
  token: getToken() || '',
  force: {
    printConfig: true,
    extends: extnds,
    // Disable alerts since the PR token doesn't have perms to read them
    vulnerabilityAlerts: { enabled: false },
    // Use the config from the current branch. Unfortunately this is also merged with the
    // default branch's current config, with no way to disable.
    ...(githubBranchName &&
      isPullRequest && {
        baseBranchPatterns: [githubBranchName],
        // Unfortunately there's no way to make renovate entirely ignore the default branch's config.
        // Best we can do is force it to merge the given base branch's config.
        useBaseBranchConfig: 'merge',
      }),
    // perf options
    prCacheSyncMaxPages: 1,
  },
};

export default config;
