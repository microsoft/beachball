import type { BeachballOptions } from '../types/BeachballOptions';
import type { PackageInfo, PackageInfos } from '../types/PackageInfo';
import { getDefaultOptions } from '../options/getDefaultOptions';

const defaultOptions = getDefaultOptions();

export type PartialPackageInfos = {
  [name: string]: Partial<Omit<PackageInfo, 'combinedOptions'>> & { combinedOptions?: Partial<BeachballOptions> };
};

/**
 * Makes a properly typed PackageInfos object from a partial object, filling in defaults:
 * ```
 * {
 *   name: '<key>',
 *   version: '1.0.0',
 *   private: false,
 *   combinedOptions: {},
 *   packageOptions: {},
 *   packageJsonPath: ''
 * }
 * ```
 */
export function makePackageInfos(packageInfos: PartialPackageInfos): PackageInfos {
  const acc: PackageInfos = {};
  for (const [name, info] of Object.entries(packageInfos)) {
    const { combinedOptions, ...rest } = info;
    acc[name] = {
      name,
      version: '1.0.0',
      private: false,
      combinedOptions: { ...defaultOptions, ...combinedOptions },
      packageOptions: {},
      packageJsonPath: '',
      ...rest,
    };
  }
  return acc;
}
