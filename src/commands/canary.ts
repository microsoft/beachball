import semver from 'semver';
import { performBump } from '../bump/performBump';
import { setDependentVersions } from '../bump/setDependentVersions';
import { listPackageVersions } from '../packageManager/listPackageVersions';
import { publishToRegistry } from '../publish/publishToRegistry';
import type { BeachballOptions } from '../types/BeachballOptions';
import type { PackageInfos } from '../types/PackageInfo';
import { validate } from '../validation/validate';
import { getPackageInfos } from '../monorepo/getPackageInfos';

export async function canary(options: BeachballOptions, oldPackageInfo: PackageInfos): Promise<void>;
/** @deprecated Must provide the package infos */
export async function canary(options: BeachballOptions): Promise<void>;
export async function canary(options: BeachballOptions, oldPackageInfo?: PackageInfos): Promise<void> {
  oldPackageInfo = oldPackageInfo || getPackageInfos(options.path);
  const repoInfo = validate(options, { checkChangeNeeded: false }, oldPackageInfo);
  let bumpInfo = repoInfo.bumpInfo!;

  // TODO: Previously this was called oldPackageInfo but was then passed to bumpInPlace, which mutated it...
  // If bumping based on the new versions was the intended behavior, this line should be switched
  // to use bumpInfo.packageInfos instead.
  oldPackageInfo = repoInfo.packageInfos;

  options.keepChangeFiles = true;
  options.generateChangelog = false;

  if (options.all) {
    bumpInfo = {
      ...bumpInfo,
      modifiedPackages: new Set([...bumpInfo.modifiedPackages, ...Object.keys(bumpInfo.packageInfos)]),
    };
  }

  const packageVersions = await listPackageVersions([...bumpInfo.modifiedPackages], options);

  for (const pkg of bumpInfo.modifiedPackages) {
    let newVersion = oldPackageInfo[pkg].version;

    do {
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
