import { performBump } from '../bump/performBump';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import type { BeachballOptions } from '../types/BeachballOptions';
import type { BumpInfo } from '../types/BumpInfo';
import type { PackageInfos } from '../types/PackageInfo';
import { validate } from '../validation/validate';

/**
 * Run validation, bump versions, and update changelogs, but don't commit, push, or publish.
 * @returns bump info for testing
 */
export async function bump(options: BeachballOptions, packageInfos: PackageInfos): Promise<BumpInfo>;
/** @deprecated Must provide the package infos */
export async function bump(options: BeachballOptions): Promise<BumpInfo>;
export async function bump(options: BeachballOptions, packageInfos?: PackageInfos): Promise<BumpInfo> {
  packageInfos ||= getPackageInfos(options.path);
  const bumpInfo = validate(options, { checkChangeNeeded: false }, packageInfos).bumpInfo!;

  // The bumpInfo is returned for testing
  return performBump(bumpInfo, options);
}
