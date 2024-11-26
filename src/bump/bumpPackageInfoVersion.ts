import semver from 'semver';
import type { BeachballOptions } from '../types/BeachballOptions';
import type { PackageInfo } from '../types/PackageInfo';
import type { ChangeType } from '../types/ChangeInfo';

/**
 * Bumps an individual package version based on the change type.
 * **This mutates `info.version`!**
 *
 * @returns whether the package version was bumped.
 */
export function bumpPackageInfoVersion(
  pkgName: string,
  info: PackageInfo | undefined,
  changeType: ChangeType | undefined,
  options: Pick<BeachballOptions, 'prereleasePrefix' | 'identifierBase'>
): boolean {
  if (!info) {
    console.log(`Unknown package named "${pkgName}" detected from change files, skipping!`);
  } else if (changeType === 'none') {
    console.log(`"${pkgName}" has a "none" change type, no version bump is required.`);
  } else if (info.private) {
    console.log(`Skipping bumping private package "${pkgName}"`);
  } else if (changeType) {
    // Ensure we can bump the correct versions
    let bumpType = changeType;
    if (options.prereleasePrefix && !['premajor', 'preminor', 'prepatch'].includes(changeType)) {
      bumpType = 'prerelease';
    }

    // Attempt to update the version
    const newVersion = semver.inc(
      info.version,
      bumpType,
      options.prereleasePrefix || undefined,
      options.identifierBase
    );

    if (!newVersion) {
      let message = `Invalid version bump requested for "${pkgName}": from version "${info.version}", change type "${changeType}"`;
      if (changeType.startsWith('pre')) {
        message += `, prerelease prefix ${JSON.stringify(options.prereleasePrefix)}, identifier base ${JSON.stringify(
          options.identifierBase
        )}`;
      }
      console.warn(message);
      return false;
    }

    info.version = newVersion;
    return true;
  }

  return false;
}
