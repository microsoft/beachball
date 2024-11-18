import { cosmiconfigSync } from 'cosmiconfig';
import { CliOptions, PackageOptions, RepoOptions } from '../types/BeachballOptions';
import { getCliOptions } from './getCliOptions';
import { getRepoOptions } from './getRepoOptions';
import { getDefaultOptions } from './getDefaultOptions';
import path from 'path';
import { env } from '../env';

/**
 * Gets all package level options (default + root options + package options + cli options)
 * This function inherits packageOptions from the repoOptions
 */
export function getCombinedPackageOptions(
  actualPackageOptions: Partial<PackageOptions>,
  testOptions?: {
    cliOptions?: CliOptions;
    repoOptions?: RepoOptions;
  }
): PackageOptions {
  const defaultOptions = getDefaultOptions();
  // Don't use options from process.argv or the beachball repo in tests
  const cliOptions = testOptions?.cliOptions || (!env.isJest ? getCliOptions(process.argv) : undefined);
  const repoOptions = cliOptions?.path ? getRepoOptions(cliOptions) : undefined;

  // Repo options and package options could potentially have nested objects.
  return mergeObjects(defaultOptions, repoOptions, actualPackageOptions, cliOptions) as PackageOptions;
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

function mergeObjects(...objects: (Record<string, any> | undefined)[]) {
  const acc: Record<string, any> = {};

  for (const obj of objects) {
    if (!obj || typeof obj !== 'object') {
      continue;
    }

    for (const [key, val] of Object.entries(obj)) {
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        acc[key] = mergeObjects([acc[key] || {}, val]);
      } else {
        acc[key] = val;
      }
    }
  }

  return acc;
}
