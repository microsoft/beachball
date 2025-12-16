import semver from 'semver';
import { bumpInMemory } from '../bump/bumpInMemory';
import { performBump } from '../bump/performBump';
import { setDependentVersions } from '../bump/setDependentVersions';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import { listPackageVersions } from '../packageManager/listPackageVersions';
import { publishToRegistry } from '../publish/publishToRegistry';
import type { BeachballOptions } from '../types/BeachballOptions';
import type { PackageInfos } from '../types/PackageInfo';
import type { BumpInfo } from '../types/BumpInfo';

/**
 * Bump and publish a "canary" prerelease version.
 * @param oldPackageInfo Pre-read package info prior to version bumps
 * @param bumpInfo Pre-calculated bump info from `validate()` (can be undefined for tests)
 */
export async function canary(
  options: BeachballOptions,
  oldPackageInfo: PackageInfos,
  bumpInfo: BumpInfo | undefined
): Promise<void>;
/** @deprecated Must provide the package infos */
export async function canary(options: BeachballOptions): Promise<void>;
export async function canary(
  options: BeachballOptions,
  oldPackageInfo?: PackageInfos,
  bumpInfo?: BumpInfo
): Promise<void> {
  // eslint-disable-next-line etc/no-deprecated
  oldPackageInfo = oldPackageInfo || getPackageInfos(options.path);

  bumpInfo ||= bumpInMemory(options, oldPackageInfo);

  options.keepChangeFiles = true;
  options.generateChangelog = false;

  if (options.all) {
    for (const pkg of Object.keys(oldPackageInfo)) {
      bumpInfo.modifiedPackages.add(pkg);
    }
  }

  const packageVersions = await listPackageVersions([...bumpInfo.modifiedPackages], options);

  for (const pkg of bumpInfo.modifiedPackages) {
    let newVersion = oldPackageInfo[pkg].version;

    do {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      newVersion = semver.inc(newVersion, 'prerelease', options.canaryName || 'canary')!;
    } while (packageVersions[pkg].includes(newVersion));

    bumpInfo.packageInfos[pkg].version = newVersion;
  }

  setDependentVersions(bumpInfo, options);

  await performBump(bumpInfo, options);

  if (options.publish || options.packToPath) {
    await publishToRegistry(bumpInfo, options);
  } else {
    console.log('Skipping publish');
  }
}
