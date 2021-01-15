import { cosmiconfigSync } from 'cosmiconfig';
import { RepoOptions } from '../types/BeachballOptions';
import { getCliOptions } from './getCliOptions';

export function getRootOptions(argv: string[]): RepoOptions {
  const {configPath} = getCliOptions(argv);

  if (configPath) {
    const repoOptions = tryLoadConfig(configPath);
    if (!repoOptions) {
      console.error(`Config file "${configPath}" could not be loaded`);
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
