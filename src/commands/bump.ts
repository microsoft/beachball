import { bumpInMemory } from '../bump/bumpInMemory';
import { performBump } from '../bump/performBump';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import type { BeachballOptions } from '../types/BeachballOptions';
import type { BumpInfo } from '../types/BumpInfo';
import type { PackageInfos } from '../types/PackageInfo';

/**
 * Bump versions and update changelogs, but don't commit, push, or publish.
 * @param oldPackageInfo Pre-read package info prior to version bumps
 * @param bumpInfo Pre-calculated bump info from `validate()` (can be undefined for tests)
 */
export async function bump(
  options: BeachballOptions,
  oldPackageInfo: PackageInfos,
  bumpInfo?: BumpInfo
): Promise<BumpInfo>;
/** @deprecated Must provide the package infos */
export async function bump(options: BeachballOptions): Promise<BumpInfo>;
export async function bump(
  options: BeachballOptions,
  oldPackageInfo?: PackageInfos,
  bumpInfo?: BumpInfo
): Promise<BumpInfo> {
  // eslint-disable-next-line etc/no-deprecated
  bumpInfo ||= bumpInMemory(options, oldPackageInfo || getPackageInfos(options.path));
  // The bumpInfo is returned for testing
  return performBump(bumpInfo, options);
}
