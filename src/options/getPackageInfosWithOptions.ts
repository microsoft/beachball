import type { PackageInfo as WSPackageInfo } from 'workspace-tools';
import type {
  ParsedOptions,
  PackageOptions,
  BeachballOptions,
  CliOptions,
  RepoOptions,
} from '../types/BeachballOptions';
import { getCliOptions } from './getCliOptions';
import { getRepoOptions } from './getRepoOptions';
import { getDefaultOptions } from './getDefaultOptions';
import { env } from '../env';
import type { PackageInfos } from '../types/PackageInfo';

/**
 * Fill in options to convert `workspace-tools` `PackageInfos` to the format used in this repo,
 * which includes merged beachball options.
 */
export function getPackageInfosWithOptions(
  wsPackageInfos: WSPackageInfo[],
  parsedOptions: Pick<ParsedOptions, 'repoOptions' | 'cliOptions'>
): PackageInfos;
/** @deprecated Provide the pre-parsed options */
export function getPackageInfosWithOptions(wsPackageInfos: WSPackageInfo[]): PackageInfos;
export function getPackageInfosWithOptions(
  wsPackageInfos: WSPackageInfo[],
  parsedOptions?: Pick<ParsedOptions, 'repoOptions' | 'cliOptions'>
): PackageInfos {
  let { repoOptions, cliOptions } = parsedOptions || {};
  if (!repoOptions || !cliOptions) {
    // Don't use options from process.argv or the beachball repo in tests
    cliOptions = !env.isJest ? getCliOptions(process.argv) : { path: '', command: 'change' };
    repoOptions = cliOptions?.path ? getRepoOptions(cliOptions) : {};
  }
  const defaultOptions = getDefaultOptions();
  const preMergedOptions = _mergePackageOptions({
    defaultOptions,
    repoOptions,
    cliOptions,
    packageOptions: {},
  });

  const packageInfos: PackageInfos = {};

  for (const packageJson of wsPackageInfos) {
    // Package-level JS config files aren't currently supported - https://github.com/microsoft/beachball/issues/1021
    // (just the "beachball" key in package.json).
    // If the package has no specific options (most common), reuse the pre-merged object for performance.
    const packageOptions = packageJson.beachball as Partial<PackageOptions> | undefined;
    const combinedOptions = packageOptions
      ? _mergePackageOptions({ defaultOptions, repoOptions, cliOptions, packageOptions })
      : { ...preMergedOptions };

    packageInfos[packageJson.name] = {
      name: packageJson.name,
      version: packageJson.version,
      packageJsonPath: packageJson.packageJsonPath,
      dependencies: packageJson.dependencies,
      devDependencies: packageJson.devDependencies,
      peerDependencies: packageJson.peerDependencies,
      optionalDependencies: packageJson.optionalDependencies,
      private: packageJson.private ?? false,
      combinedOptions,
      packageOptions: packageOptions || {},
    };
  }

  return packageInfos;
}

const packageKeys = Object.keys({
  tag: true,
  defaultNpmTag: true,
  disallowedChangeTypes: true,
  gitTags: true,
  shouldPublish: true,
} satisfies Record<keyof PackageOptions, true>) as (keyof PackageOptions)[];

/**
 * Merge ONLY the relevant package-level options into `combinedOptions`.
 * In giant repos, this should improve performance.
 */
export function _mergePackageOptions(
  params: Pick<ParsedOptions, 'repoOptions' | 'cliOptions'> & {
    packageOptions: Partial<PackageOptions>;
    defaultOptions: BeachballOptions;
  }
): PackageOptions {
  const { defaultOptions, repoOptions, cliOptions, packageOptions } = params;
  const mergedOptions = {} as PackageOptions;
  for (const key of packageKeys) {
    (mergedOptions as any)[key] =
      key in cliOptions
        ? cliOptions[key as keyof CliOptions]
        : key in packageOptions
        ? packageOptions[key]
        : key in repoOptions
        ? repoOptions[key as keyof RepoOptions]
        : defaultOptions[key];
  }
  return mergedOptions;
}
