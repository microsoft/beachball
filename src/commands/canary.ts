import semver from 'semver';
import { gatherBumpInfo } from '../bump/gatherBumpInfo';
import { performBump } from '../bump/performBump';
import { setDependentVersions } from '../bump/setDependentVersions';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import { listPackageVersions } from '../packageManager/listPackageVersions';
import { publishToRegistry } from '../publish/publishToRegistry';
import { BeachballOptions } from '../types/BeachballOptions';

export async function canary(options: BeachballOptions) {
  const oldPackageInfo = getPackageInfos(options.path);
  const bumpInfo = gatherBumpInfo(options);

  options.keepChangeFiles = true;
  options.generateChangelog = false;
  options.tag = options.canaryName || 'canary';

  const packageVersions = await listPackageVersions([...bumpInfo.modifiedPackages], options.registry);

  for (const pkg of bumpInfo.modifiedPackages) {
    let newVersion = oldPackageInfo[pkg].version;

    do {
      newVersion = semver.inc(newVersion, 'prerelease', options.canaryName || 'canary');
    } while (packageVersions[pkg].includes(newVersion));

    bumpInfo.packageInfos[pkg].version = newVersion;
  }

  setDependentVersions(bumpInfo.packageInfos);

  await performBump(bumpInfo, options);

  await publishToRegistry(bumpInfo, options);
}
