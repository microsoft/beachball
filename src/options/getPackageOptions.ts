import { cosmiconfigSync } from 'cosmiconfig';
import { PackageOptions } from '../types/BeachballOptions';
import { getCliOptions } from './getCliOptions';
import { getRootOptions } from './getRootOptions';
import { getDefaultOptions } from './getDefaultOptions';

/**
 * Gets all package level options (default + root options + package options + cli options)
 * This function inherits packageOptions from the rootOptions
 */
export function getCombinedPackageOptions(actualPackageOptions: PackageOptions): PackageOptions {
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
export function getPackageOptions(packagePath: string): PackageOptions {
  const defaultOptions = getDefaultOptions();
  const configExplorer = cosmiconfigSync('beachball', { cache: false });
  try {
    const results = configExplorer.load(packagePath);
    return results && results.config;
  } catch (e) {
    // File does not exist, returns the default packageOptions
    return {
      gitTags: defaultOptions.gitTags,
      disallowedChangeTypes: defaultOptions.disallowedChangeTypes,
      defaultNpmTag: defaultOptions.defaultNpmTag,
    };
  }
}
