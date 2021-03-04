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
    repoOptions = trySearchConfig();
  }
  repoOptions = repoOptions || ({} as RepoOptions);

  if (!cliOptions.branch) {
    // Add or fix up the branch in repoOptions if it's not specified in cliOptions (which takes precedence)
    if (repoOptions.branch && !repoOptions.branch.includes('/')) {
      repoOptions.branch = getDefaultRemoteBranch(repoOptions.branch, cliOptions.path);
    } else if (!repoOptions.branch) {
      repoOptions.branch = getDefaultRemoteBranch('master', cliOptions.path);
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
