import _ from 'lodash';
import { BeachballOptions } from '../types/BeachballOptions';
import { PackageInfo, PackageInfos } from '../types/PackageInfo';
import { getDefaultOptions } from '../options/getDefaultOptions';

const defaultOptions = getDefaultOptions();

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
export function makePackageInfos(packageInfos: {
  [name: string]: Partial<Omit<PackageInfo, 'combinedOptions'>> & { combinedOptions?: Partial<BeachballOptions> };
}): PackageInfos {
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
