import { cosmiconfigSync } from 'cosmiconfig';
import { RepoOptions } from '../types/BeachballOptions';

export function getRootOptions(): RepoOptions {
  const configExplorer = cosmiconfigSync('beachball');
  const searchResults = configExplorer.search();
  if (searchResults && searchResults.config) {
    return searchResults.config;
  }
  return {} as RepoOptions;
}
