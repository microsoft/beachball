import _ from 'lodash';
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
  return _.mapValues(packageInfos, (info, name): PackageInfo => {
    const { combinedOptions, ...rest } = info;
    return {
      name,
      version: '1.0.0',
      private: false,
      combinedOptions: { ...defaultOptions, ...combinedOptions },
      packageOptions: {},
      packageJsonPath: '',
      ...rest,
    };
  });
}
