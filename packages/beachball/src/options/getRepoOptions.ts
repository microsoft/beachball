import type { ParsedOptions, RepoOptions } from '../types/BeachballOptions';
import { resolveBranchOption } from './getCliOptions';
import { readConfig } from './readConfig';

/**
 * Find the beachball config file and return the repo options.
 *
 * If `cliOptions.path` is empty, it's assumed to be running in a test without a filesystem
 * and returns an empty object.
 */
export async function getRepoOptions(cliOptions: ParsedOptions['cliOptions']): Promise<Partial<RepoOptions>> {
  const { path: cwd } = cliOptions;

  if (!cwd) {
    // If cwd is empty, it's probably running in a test without a filesystem.
    return {};
  }

  const repoOptions = (await readConfig<Partial<RepoOptions>>({ path: cwd, configPath: cliOptions.configPath })) || {};

  // Only if the branch isn't specified in cliOptions (which takes precedence), fix it up or add it
  // in repoOptions
  if (!cliOptions.branch) {
    repoOptions.branch = resolveBranchOption(repoOptions, cwd);
  }

  return repoOptions;
}
