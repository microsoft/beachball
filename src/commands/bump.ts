import { gatherBumpInfo } from '../bump/gatherBumpInfo';
import { performBump } from '../bump/performBump';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import type { BeachballOptions } from '../types/BeachballOptions';
import type { BumpInfo } from '../types/BumpInfo';
import type { PackageInfos } from '../types/PackageInfo';

/**
 * Bump versions and update changelogs, but don't commit, push, or publish.
 */
export async function bump(options: BeachballOptions, packageInfos: PackageInfos): Promise<BumpInfo>;
/** @deprecated Must provide the package infos */
export async function bump(options: BeachballOptions): Promise<BumpInfo>;
export async function bump(options: BeachballOptions, packageInfos?: PackageInfos): Promise<BumpInfo> {
  const bumpInfo = gatherBumpInfo(options, packageInfos || getPackageInfos(options.path));
  // The bumpInfo is returned for testing
  return performBump(bumpInfo, options);
}
