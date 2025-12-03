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
    console.log(`Unknown package named "${pkgName}" detected from change files, skipping!`);
  } else if (changeType === 'none') {
    console.log(`"${pkgName}" has a "none" change type, no version bump is required.`);
  } else if (info.private) {
    console.log(`Skipping bumping private package "${pkgName}"`);
  } else {
    // Ensure we can bump the correct versions
    const bumpAsPrerelease = !!options.prereleasePrefix && !['premajor', 'preminor', 'prepatch'].includes(changeType);

    // Version should be updated
    info.version = semver.inc(
      info.version,
      bumpAsPrerelease ? 'prerelease' : changeType,
      undefined,
      options.prereleasePrefix || undefined,
      options.identifierBase
    ) as string;

    modifiedPackages.add(pkgName);
  }
}
