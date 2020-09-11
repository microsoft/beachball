import { cosmiconfigSync } from 'cosmiconfig';
import { PackageOptions } from '../types/BeachballOptions';
import { getCliOptions } from './getCliOptions';
import { getRootOptions } from './getRootOptions';
import { getDefaultOptions } from './getDefaultOptions';

/**
 * Gets all package level options (default + root options + package options + cli options)
 * This function inherits packageOptions from the rootOptions
 */
export function getPackageOptions(actualPackageOptions: PackageOptions): PackageOptions {
  const defaultOptions = getDefaultOptions();
  const rootOptions = getRootOptions();
  return {
    ...defaultOptions,
    ...rootOptions,
    ...actualPackageOptions,
    ...getCliOptions(),
  };
}

/**
 * Gets all the package options from the configuration file of the package itself without inheritance
 */
export function getActualPackageOptions(packagePath: string): PackageOptions {
  const configExplorer = cosmiconfigSync('beachball', { cache: false });
  const searchResults = configExplorer.search(packagePath);
  return searchResults && searchResults.config;
}
