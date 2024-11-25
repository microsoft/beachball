import { cosmiconfigSync } from 'cosmiconfig';
import type { PackageOptions } from '../types/BeachballOptions';
import { getCliOptions } from './getCliOptions';
import { getRepoOptions } from './getRepoOptions';
import { getDefaultOptions } from './getDefaultOptions';
import path from 'path';
import { env } from '../env';

/**
 * Gets all package level options (default + root options + package options + cli options)
 * This function inherits packageOptions from the repoOptions
 */
export function getCombinedPackageOptions(actualPackageOptions: Partial<PackageOptions>): PackageOptions {
  const defaultOptions = getDefaultOptions();
  // Don't use options from process.argv or the beachball repo in tests
  const cliOptions = !env.isJest && getCliOptions(process.argv);
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
    return (results?.config as PackageOptions) || {};
  } catch {
    // File does not exist, returns the default packageOptions
    return {};
  }
}
