import semver from 'semver';
import { gatherBumpInfo } from '../bump/gatherBumpInfo';
import { performBump } from '../bump/performBump';
import { setDependentVersions } from '../bump/setDependentVersions';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import { listPackageVersions } from '../packageManager/listPackageVersions';
import { publishToRegistry } from '../publish/publishToRegistry';
import type { BeachballOptions } from '../types/BeachballOptions';

export async function canary(options: BeachballOptions): Promise<void> {
  const oldPackageInfo = getPackageInfos(options.path);

  const bumpInfo = gatherBumpInfo(options, oldPackageInfo);

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

  if (options.publish) {
    await publishToRegistry(bumpInfo, options);
  } else {
    console.log('Skipping publish');
  }
}
