import semver from 'semver';
import { gatherBumpInfo } from '../bump/gatherBumpInfo';
import { performBump } from '../bump/performBump';
import { setDependentVersions } from '../bump/setDependentVersions';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import { publishToRegistry } from '../publish/publishToRegistry';
import { BeachballOptions } from '../types/BeachballOptions';

export async function canary(options: BeachballOptions) {
  const oldPackageInfo = getPackageInfos(options.path);

  const bumpInfo = gatherBumpInfo(options);

  options.keepChangeFiles = true;
  options.generateChangelog = false;
  options.tag = options.canaryName || 'canary';
  options.tag = options.canaryName || 'canary';

  for (const pkg of bumpInfo.modifiedPackages) {
    bumpInfo.packageInfos[pkg].version = semver.inc(
      oldPackageInfo[pkg].version,
      'prerelease',
      options.canaryName || 'canary'
    );
  }

  setDependentVersions(bumpInfo.packageInfos);

  await performBump(bumpInfo, options);

  await publishToRegistry(bumpInfo, options);
}
