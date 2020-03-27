import { BumpInfo } from '../types/BumpInfo';
import semver from 'semver';

/**
 * Bumps an individual package version based on the change type
 */
export function bumpPackageInfoVersion(pkgName: string, bumpInfo: BumpInfo) {
  const { packageChangeTypes, packageInfos, modifiedPackages } = bumpInfo;
  const info = packageInfos[pkgName];
  const changeType = packageChangeTypes[pkgName];
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
    info.version = semver.inc(info.version, changeType) as string;
    modifiedPackages.add(pkgName);
  }
}
