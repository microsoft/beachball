import { cosmiconfigSync } from 'cosmiconfig';
import { getDefaultRemoteBranch } from 'workspace-tools';
import { RepoOptions, CliOptions } from '../types/BeachballOptions';

export function getRepoOptions(cliOptions: CliOptions): RepoOptions {
  let repoOptions: RepoOptions | null;
  if (cliOptions.configPath) {
    repoOptions = tryLoadConfig(cliOptions.configPath);
    if (!repoOptions) {
      console.error(`Config file "${cliOptions.configPath}" could not be loaded`);
      process.exit(1);
    }
  } else {
    repoOptions = trySearchConfig() || ({} as RepoOptions);
  }

  // Only if the branch isn't specified in cliOptions (which takes precedence), fix it up or add it
  // in repoOptions. (We don't want to do the getDefaultRemoteBranch() lookup unconditionally to
  // avoid potential for log messages/errors which aren't relevant if the branch was specified on
  // the command line.)
  if (!cliOptions.branch) {
    if (repoOptions.branch && !repoOptions.branch.includes('/')) {
      // Add a remote to the branch if it's not already included
      repoOptions.branch = getDefaultRemoteBranch(repoOptions.branch, cliOptions.path);
    } else if (!repoOptions.branch) {
      // Branch is not specified at all. Add in the default remote and branch.
      repoOptions.branch = getDefaultRemoteBranch(undefined, cliOptions.path);
    }
  }

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
