import type { PackageInfo, PackageInfos } from '../types/PackageInfo';
import { getPackageInfosWithOptions } from '../options/getPackageInfosWithOptions';
import type { CliOptions, RepoOptions } from '../types/BeachballOptions';
import { defaultRemoteBranchName } from './gitDefaults';

export type PartialPackageInfos = {
  [name: string]: Omit<Partial<PackageInfo>, 'combinedOptions' | 'packageOptions'> & {
    beachball?: PackageInfo['packageOptions'];
  };
};

/**
 * Makes a properly typed PackageInfos object from a partial object, filling in defaults:
 * ```js
 * {
 *   name: '<key>',
 *   version: '1.0.0',
 *   private: false,
 *   packageJsonPath: ''
 * }
 * ```
 * Other defaults and values are filled by the actual logic in `getPackageInfosWithOptions`,
 * including the overrides in `repoOptions` merged in realistic order.
 */
export function makePackageInfos(
  packageInfos: PartialPackageInfos,
  repoOptions?: Partial<RepoOptions>,
  cliOptions?: Partial<CliOptions>
): PackageInfos {
  return getPackageInfosWithOptions(
    Object.entries(packageInfos).map(([name, info]) => {
      return {
        name,
        version: '1.0.0',
        private: false,
        packageOptions: {},
        packageJsonPath: '',
        ...info,
      };
    }),
    {
      repoOptions: { branch: defaultRemoteBranchName, ...repoOptions },
      cliOptions: { path: '', command: '', ...cliOptions },
    }
  );
}
