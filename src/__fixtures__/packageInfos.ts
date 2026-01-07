import path from 'path';
import type { PackageInfo as WSPackageInfo } from 'workspace-tools';
import type { PackageInfo, PackageInfos } from '../types/PackageInfo';
import { getPackageInfosWithOptions } from '../options/getPackageInfosWithOptions';
import type { CliOptions } from '../types/BeachballOptions';

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
 * including merging the CLI options where they override package-specific options.
 * @param cliOptions CLI options. Use `path` to specify the CWD.
 */
export function makePackageInfos(packageInfos: PartialPackageInfos, cliOptions?: Partial<CliOptions>): PackageInfos {
  const cwd = cliOptions?.path || '';
  return getPackageInfosWithOptions(
    Object.entries(packageInfos).map(
      ([name, info]): WSPackageInfo => ({
        name,
        version: '1.0.0',
        packageJsonPath: path.join(cwd, 'packages', path.basename(name), 'package.json'),
        ...info,
      })
    ),
    { path: cwd, ...cliOptions }
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
 * including merging the CLI options where they override package-specific options.
 */
export function makePackageInfosByFolder(params: {
  packages: { [folder: string]: PartialPackageInfo };
  cwd: string;
  /** Extra CLI options */
  cliOptions?: Partial<Omit<CliOptions, 'path'>>;
}): PackageInfos {
  const { packages, cwd, cliOptions } = params;
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
    { ...cliOptions, path: cwd }
  );
}
