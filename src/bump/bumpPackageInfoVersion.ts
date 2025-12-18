import type { BumpInfo } from '../types/BumpInfo';
import semver from 'semver';
import type { BeachballOptions } from '../types/BeachballOptions';

/**
 * Bumps an individual package version based on the change type.
 * **This mutates `info.version` and `bumpInfo.modifiedPackages`!**
 */
export function bumpPackageInfoVersion(
  pkgName: string,
  bumpInfo: Pick<BumpInfo, 'calculatedChangeTypes' | 'packageInfos' | 'modifiedPackages'>,
  options: Pick<BeachballOptions, 'prereleasePrefix' | 'identifierBase'>
): void {
  const { calculatedChangeTypes, packageInfos, modifiedPackages } = bumpInfo;
  const info = packageInfos[pkgName];
  const changeType = calculatedChangeTypes[pkgName];

  if (!info) {
    console.warn(`Unknown package named "${pkgName}" detected from change files, skipping!`);
  } else if (!changeType) {
    console.warn(`No change type found when bumping "${pkgName}" (this may be a beachball bug)`);
  } else if (changeType === 'none') {
    console.log(`"${pkgName}" has a "none" change type, so no version bump is required.`);
  } else if (info.private) {
    console.warn(`Skipping bumping private package "${pkgName}"`);
  } else {
    // Ensure we can bump the correct versions
    const effectiveChangeType =
      options.prereleasePrefix && !['premajor', 'preminor', 'prepatch'].includes(changeType)
        ? 'prerelease'
        : changeType;

    // Attempt to update the version
    const newVersion = semver.inc(
      info.version,
      effectiveChangeType,
      undefined,
      options.prereleasePrefix || undefined,
      options.identifierBase
    );

    if (newVersion) {
      info.version = newVersion;
      modifiedPackages.add(pkgName);
    } else {
      let message = `Invalid version bump requested for "${pkgName}": from version "${info.version}", change type "${effectiveChangeType}"`;
      if (effectiveChangeType.startsWith('pre')) {
        if (options.prereleasePrefix) {
          message += `, prerelease prefix "${options.prereleasePrefix}"`;
        }
        if (options.identifierBase) {
          message += `, identifier base "${options.identifierBase}"`;
        }
      }
      console.warn(message);
    }
  }
}
