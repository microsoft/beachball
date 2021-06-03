import { BumpInfo } from '../types/BumpInfo';
import semver from 'semver';
import { BeachballOptions } from '../types/BeachballOptions';

/**
 * Bumps an individual package version based on the change type
 */
export function bumpPackageInfoVersion(pkgName: string, bumpInfo: BumpInfo, options: BeachballOptions) {
  const { calculatedChangeInfos, packageInfos, modifiedPackages } = bumpInfo;
  const info = packageInfos[pkgName];
  const changeType = calculatedChangeInfos[pkgName]?.type;
  if (!info) {
    console.log(`Unknown package named "${pkgName}" detected from change files, skipping!`);
    return;
  }
  if (changeType === 'none') {
    console.log(`"${pkgName}" has a "none" change type, no version bump is required.`);
    return;
  }
  if (info.private) {
    console.log(`Skipping bumping private package "${pkgName}"`);
    return;
  }
  if (!info.private) {
    info.version = semver.inc(info.version, changeType, options.prereleasePrefix) as string;
    modifiedPackages.add(pkgName);
  }
}
