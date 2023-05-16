import { cosmiconfigSync } from 'cosmiconfig';
import { getDefaultRemoteBranch } from 'workspace-tools';
import { env } from '../env';
import { RepoOptions, CliOptions, BeachballOptions } from '../types/BeachballOptions';

let cachedRepoOptions = new Map<CliOptions, RepoOptions>();

export function getRepoOptions(cliOptions: CliOptions): RepoOptions {
  const { configPath, path: cwd, branch } = cliOptions;
  if (!env.beachballDisableCache && cachedRepoOptions.has(cliOptions)) {
    return cachedRepoOptions.get(cliOptions)!;
  }

  let repoOptions: RepoOptions | null;
  if (configPath) {
    repoOptions = tryLoadConfig(configPath);
    if (!repoOptions) {
      console.error(`Config file "${configPath}" could not be loaded`);
      process.exit(1);
    }
  } else {
    repoOptions = trySearchConfig() || ({} as RepoOptions);
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

function tryLoadConfig(configPath: string): RepoOptions | null {
  const configExplorer = cosmiconfigSync('beachball');
  const loadResults = configExplorer.load(configPath);
  return (loadResults && loadResults.config) || null;
}

function trySearchConfig(): RepoOptions | null {
  const configExplorer = cosmiconfigSync('beachball');
  const searchResults = configExplorer.search();
  return (searchResults && searchResults.config) || null;
}
