import path from 'path';
import type { PackageInfo as WSPackageInfo } from 'workspace-tools';
import type { PackageInfo, PackageInfos } from '../types/PackageInfo';
import { getPackageInfosWithOptions } from '../options/getPackageInfosWithOptions';
import type { CliOptions, RepoOptions } from '../types/BeachballOptions';
import { defaultRemoteBranchName } from './gitDefaults';

export type PartialPackageInfo = Omit<Partial<PackageInfo>, 'combinedOptions' | 'packageOptions'> & {
  beachball?: PackageInfo['packageOptions'];
};

export type PartialPackageInfos = {
  [name: string]: PartialPackageInfo;
};

/**
 * Makes a properly typed PackageInfos object from a partial object, filling in defaults:
 * ```js
 * {
 *   name: '<key>',
 *   version: '1.0.0',
 *   private: false,
 *   packageJsonPath: `${cliOptions.path || ''}/packages/<basename>/package.json`,
 * }
 * ```
 * Other defaults and values are filled by the actual logic in `getPackageInfosWithOptions`,
 * including the overrides in `repoOptions` merged in realistic order.
 * @param repoOptions Extra repo options. A `branch` option is included automatically (to prevent lookup).
 * @param cliOptions CLI options. Use `path` to specify the CWD.
 */
export function makePackageInfos(
  packageInfos: PartialPackageInfos,
  repoOptions?: Partial<RepoOptions>,
  cliOptions?: Partial<CliOptions>
): PackageInfos {
  const cwd = cliOptions?.path || '';
  return getPackageInfosWithOptions(
    Object.entries(packageInfos).map(
      ([name, info]): WSPackageInfo => ({
        name,
        version: '1.0.0',
        private: false,
        packageJsonPath: path.join(cwd, 'packages', path.basename(name), 'package.json'),
        ...info,
      })
    ),
    {
      repoOptions: { branch: defaultRemoteBranchName, ...repoOptions },
      cliOptions: { path: cwd, command: '', ...cliOptions },
    }
  );
}

/**
 * Makes a properly typed PackageInfos object from a partial object, filling in defaults:
 * ```js
 * {
 *   name: '<folder basename>',
 *   version: '1.0.0',
 *   private: false,
 *   packageJsonPath: `${cwd}/${key}/package.json`,
 * }
 * ```
 * Other defaults and values are filled by the actual logic in `getPackageInfosWithOptions`,
 * including the overrides in `repoOptions` merged in realistic order.
 */
export function makePackageInfosByFolder(params: {
  packages: { [folder: string]: PartialPackageInfo };
  cwd: string;
  /** Extra repo options. A `branch` option is included automatically (to prevent lookup). */
  repoOptions?: Partial<RepoOptions>;
  /** Extra CLI options */
  cliOptions?: Partial<Omit<CliOptions, 'path'>>;
}): PackageInfos {
  const { packages, cwd, repoOptions, cliOptions } = params;
  return makePackageInfos(
    Object.fromEntries(
      Object.entries(packages).map(([folder, info]) => [
        path.basename(folder),
        {
          packageJsonPath: path.join(cwd, folder, 'package.json'),
          ...info,
        },
      ])
    ),
    repoOptions,
    { ...cliOptions, path: cwd }
  );
}
