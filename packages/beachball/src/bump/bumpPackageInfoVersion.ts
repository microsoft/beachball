import type { BumpInfo } from '../types/BumpInfo';
import semver from 'semver';

/**
 * Bumps an individual package version based on the change type.
 *
 * If the package's current version has a prerelease component (e.g. `1.0.0-beta.0`), it is
 * stripped before applying the bump, so a `patch` change goes from `1.0.0-beta.0` -> `1.0.1`
 * (not `1.0.0`). This corresponds to publishing a release after a prerelease cycle.
 *
 * **This mutates `info.version` and `bumpInfo.modifiedPackages`!**
 */
export function bumpPackageInfoVersion(
  pkgName: string,
  bumpInfo: Pick<BumpInfo, 'calculatedChangeTypes' | 'packageInfos' | 'modifiedPackages'>
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
    // If the current version is a prerelease (e.g. "1.0.0-beta.0"), strip the prerelease
    // component before applying the bump. This handles the prerelease -> release promotion
    // case: `1.0.0-beta.0` with a `patch` change becomes `1.0.1` (not `1.0.0`, which would be
    // a downgrade in many situations and is not what users expect after a stabilization cycle).
    const baseVersion = stripPrerelease(info.version);
    const newVersion = semver.inc(baseVersion, changeType);

    if (newVersion) {
      info.version = newVersion;
      modifiedPackages.add(pkgName);
    } else {
      console.warn(
        `Invalid version bump requested for "${pkgName}": from version "${info.version}", change type "${changeType}"`
      );
    }
  }
}

/** Strip any prerelease component from a semver version. */
function stripPrerelease(version: string): string {
  const parsed = semver.parse(version);
  if (!parsed) {
    return version;
  }
  return `${parsed.major}.${parsed.minor}.${parsed.patch}`;
}
