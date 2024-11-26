import type { PackageInfo as WSPackageInfo } from 'workspace-tools';
import type { PackageOptions } from '../types/BeachballOptions';
import { getCliOptions } from './getCliOptions';
import { getRepoOptions } from './getRepoOptions';
import { getDefaultOptions } from './getDefaultOptions';
import { env } from '../env';
import type { PackageInfos } from '../types/PackageInfo';
import { mergeOptions } from './getOptions';

/**
 * Fill in options to convert `workspace-tools` `PackageInfos` to the format used in this repo,
 * which includes merged beachball options.
 */
export function getPackageInfosWithOptions(wsPackageInfos: WSPackageInfo[]): PackageInfos {
  const packageInfos: PackageInfos = {};

  // Get the CLI and repo options once instead of re-calculating for every package.
  // TODO: pass the unmerged options in instead of re-calculating...
  const defaultOptions = getDefaultOptions();
  // Don't use options from process.argv or the beachball repo in tests
  const cliOptions = !env.isJest ? getCliOptions(process.argv) : undefined;
  const repoOptions = cliOptions?.path ? getRepoOptions(cliOptions) : undefined;

  for (const packageJson of wsPackageInfos) {
    // Package-level JS config files aren't currently supported - https://github.com/microsoft/beachball/issues/1021
    // (just the "beachball" key in package.json)
    const packageOptions = (packageJson.beachball || {}) as Partial<PackageOptions>;

    packageInfos[packageJson.name] = {
      name: packageJson.name,
      version: packageJson.version,
      packageJsonPath: packageJson.packageJsonPath,
      dependencies: packageJson.dependencies,
      devDependencies: packageJson.devDependencies,
      peerDependencies: packageJson.peerDependencies,
      optionalDependencies: packageJson.optionalDependencies,
      private: packageJson.private !== undefined ? packageJson.private : false,
      combinedOptions: mergeOptions({ defaultOptions, repoOptions, cliOptions, packageOptions }),
      packageOptions,
    };
  }

  return packageInfos;
}
