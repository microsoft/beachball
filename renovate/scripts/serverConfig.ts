import { getToken } from './checkToken.ts';
import { getExtendsForLocalPreset } from './utils/extends.ts';
import { defaultBranch, defaultRepo, githubBranchName } from './utils/github.ts';
import { readPresets } from './utils/readPresets.ts';

const presets = readPresets();

// TODO: REVERT THIS (see comment where it's used about why it's temporarily done)
const tempFilteredPresets = githubBranchName === 'renovate-configs' ? presets.filter(p => !p.json?.extends) : presets;

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
  // For the basic config test to pass, the token must be a string
  token: getToken() || '',
  force: {
    printConfig: true,
    // Force an "extends" config with all the presets from this repo.
    // (Note this will NOT fix the names of extended presets within another preset,
    // so extended presets will be fetched from main, not the branch. This is usually
    // fine but will cause an error if a preset extends a newly-added preset in a PR.)
    extends: tempFilteredPresets.map(p =>
      getExtendsForLocalPreset(p, githubBranchName === defaultBranch ? '' : githubBranchName)
    ),
    // Disable alerts since the PR token doesn't have perms to read them
    vulnerabilityAlerts: { enabled: false },
    // Use the config from the current branch. Unfortunately this is also merged with the
    // default branch's current config, with no way to disable.
    ...(githubBranchName &&
      githubBranchName !== defaultBranch && {
        baseBranchPatterns: [githubBranchName],
        useBaseBranchConfig: 'merge',
      }),
    // perf options
    prCacheSyncMaxPages: 1,
  },
};

export default config;
