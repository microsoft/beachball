import { cosmiconfigSync } from 'cosmiconfig';
import { PackageOptions } from '../types/BeachballOptions';
import { getCliOptions } from './getCliOptions';
import { getRootOptions } from './getRootOptions';
import { getDefaultOptions } from './getDefaultOptions';

/**
 * Gets all package level options (default + root options + package options + cli options)
 */
export function getPackageOptions(packagePath: string): PackageOptions {
  const configExplorer = cosmiconfigSync('beachball', { cache: false });
  const searchResults = configExplorer.search(packagePath);
  const defaultOptions = getDefaultOptions();
  const rootOptions = getRootOptions();
  return {
    ...defaultOptions,
    ...rootOptions,
    ...(searchResults && searchResults.config),
    ...getCliOptions(),
  };
}
