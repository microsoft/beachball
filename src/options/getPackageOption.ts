import type { BeachballOptions, PackageOptions } from '../types/BeachballOptions';
import type { PackageInfo } from '../types/PackageInfo';

/** Subset of main options which are also package options */
export type BeachballPackageOptions = Pick<BeachballOptions, keyof PackageOptions>;

/**
 * Get a value from package-specific options (which already account for CLI overrides as stored)
 * or fall back to the main options.
 *
 * Note: for options where `null` is not a valid value, you can just use `??` instead of this function.
 *
 * @param optionName Option to get
 * @param packageInfo Package info with `packageOptions` if relevant
 * @param options All the options
 * @returns Option value
 */
export function getPackageOption<T extends keyof PackageOptions>(
  optionName: T,
  packageInfo: Pick<PackageInfo, 'packageOptions'>,
  options: Partial<Pick<BeachballOptions, T>>
): PackageOptions[T] | undefined {
  // getPackageInfosWithOptions already merged CLI overrides into packageOptions
  const value = packageInfo.packageOptions?.[optionName];
  // Return null or false if set as such
  return value !== undefined ? value : options[optionName];
}
