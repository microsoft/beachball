import semver from 'semver';
import { performBump } from '../bump/performBump';
import { setDependentVersions } from '../bump/setDependentVersions';
import { listPackageVersions } from '../packageManager/listPackageVersions';
import { publishToRegistry } from '../publish/publishToRegistry';
import type { BeachballOptions } from '../types/BeachballOptions';
import { validateWithBump } from '../validation/validate';

export async function canary(options: BeachballOptions): Promise<void> {
  const repoInfo = validateWithBump(options);
  let { bumpInfo } = repoInfo;

  // TODO: Before the shared validation/bump info change, the function did this:
  //   const oldPackageInfo = getPackageInfos(options.path);
  //   const bumpInfo = gatherBumpInfo(options, oldPackageInfo);
  // Despite the "old" name, this was actually using bumped the bumped versions...
  // If bumping based on the new versions is the intended behavior, the next line is fine.
  // But if it was supposed to use the old versions, use repoInfo.packageInfos instead.
  const oldPackageInfo = bumpInfo.packageInfos;

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
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      newVersion = semver.inc(newVersion, 'prerelease', options.canaryName || 'canary')!;
    } while (packageVersions[pkg].includes(newVersion));

    bumpInfo.packageInfos[pkg].version = newVersion;
  }

  setDependentVersions(bumpInfo, options);

  await performBump(bumpInfo, options);

  if (options.publish) {
    await publishToRegistry(bumpInfo, options);
  } else {
    console.log('Skipping publish');
  }
}
