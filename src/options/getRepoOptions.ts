import { cosmiconfigSync } from 'cosmiconfig';
import { getDefaultRemoteBranch } from 'workspace-tools';
import { env } from '../env';
import type { RepoOptions, CliOptions, BeachballOptions } from '../types/BeachballOptions';

const cachedRepoOptions = new Map<CliOptions, Partial<RepoOptions>>();

export function getRepoOptions(cliOptions: CliOptions): Partial<RepoOptions> {
  const { configPath, path: cwd, branch } = cliOptions;
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  if (!env.beachballDisableCache && cachedRepoOptions.has(cliOptions)) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- checked previously
    return cachedRepoOptions.get(cliOptions)!;
  }

  let repoOptions: Partial<RepoOptions> | null | undefined;

  const configExplorer = cosmiconfigSync('beachball', { cache: false });

  if (configPath) {
    repoOptions = configExplorer.load(configPath)?.config as Partial<RepoOptions> | undefined;
    if (!repoOptions) {
      console.error(`Config file "${configPath}" could not be loaded`);
      process.exit(1);
    }
  } else {
    repoOptions = (configExplorer.search()?.config as Partial<RepoOptions> | undefined) || {};
  }

  // Only if the branch isn't specified in cliOptions (which takes precedence), fix it up or add it
  // in repoOptions. (We don't want to do the getDefaultRemoteBranch() lookup unconditionally to
  // avoid potential for log messages/errors which aren't relevant if the branch was specified on
  // the command line.)
  if (!branch) {
    const verbose = (repoOptions as BeachballOptions).verbose;
    if (repoOptions.branch && !repoOptions.branch.includes('/')) {
      // Add a remote to the branch if it's not already included
      repoOptions.branch = getDefaultRemoteBranch({ branch: repoOptions.branch, cwd, verbose });
    } else if (!repoOptions.branch) {
      // Branch is not specified at all. Add in the default remote and branch.
      repoOptions.branch = getDefaultRemoteBranch({ cwd, verbose });
    }
  }

  cachedRepoOptions.set(cliOptions, repoOptions);

  return repoOptions;
}
