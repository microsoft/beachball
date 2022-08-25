import { cosmiconfigSync } from 'cosmiconfig';
import { PackageOptions } from '../types/BeachballOptions';
import { getCliOptions } from './getCliOptions';
import { getRepoOptions } from './getRepoOptions';
import { getDefaultOptions } from './getDefaultOptions';
import path from 'path';

/**
 * Gets all package level options (default + root options + package options + cli options)
 * This function inherits packageOptions from the repoOptions
 */
export function getCombinedPackageOptions(actualPackageOptions: Partial<PackageOptions>): PackageOptions {
  const defaultOptions = getDefaultOptions();
  // Don't use options from process.argv or the beachball repo in tests
  const cliOptions = process.env.NODE_ENV !== 'test' && getCliOptions(process.argv);
  const repoOptions = cliOptions && getRepoOptions(cliOptions);
  return {
    ...defaultOptions,
    ...repoOptions,
    ...actualPackageOptions,
    ...cliOptions,
  };
}

/**
 * Gets all the package options from the configuration file of the package itself without inheritance
 */
export function getPackageOptions(packagePath: string): Partial<PackageOptions> {
  const configExplorer = cosmiconfigSync('beachball', { cache: false });
  try {
    const results = configExplorer.load(path.join(packagePath, 'package.json'));
    return (results && results.config) || {};
  } catch (e) {
    // File does not exist, returns the default packageOptions
    return {};
  }
}
