import { cosmiconfigSync } from 'cosmiconfig';
import { RepoOptions, CliOptions } from '../types/BeachballOptions';

export function getRootOptions(cliOptions: CliOptions): RepoOptions {
  if (cliOptions.configPath) {
    const repoOptions = tryLoadConfig(cliOptions.configPath);
    if (!repoOptions) {
      console.error(`Config file "${cliOptions.configPath}" could not be loaded`);
      process.exit(1);
    }

    return repoOptions;
  }

  return trySearchConfig() || {};
}

function tryLoadConfig(configPath: string): RepoOptions {
  const configExplorer = cosmiconfigSync('beachball');
  const loadResults = configExplorer.load(configPath);
  return (loadResults && loadResults.config) || null;
}

function trySearchConfig(): RepoOptions {
  const configExplorer = cosmiconfigSync('beachball');
  const searchResults = configExplorer.search();
  return (searchResults && searchResults.config) || null;
}
