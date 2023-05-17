import { formatList } from '../logging/format';
import { BumpInfo } from '../types/BumpInfo';
import { toposortPackages } from './toposortPackages';

/**
 * Determine which of the modified/new packages in bump info should actually be published
 * (based only on the bump info, not the registry).
 *
 * Unless `validationMode` is true, the returned package names will also be topologically sorted
 * based on the dependency graph to ensure they're published in the correct order, and any
 * new/modified packages that will be skipped (and why) are logged to the console.
 */
export function getPackagesToPublish(bumpInfo: BumpInfo, validationMode?: boolean) {
  const { modifiedPackages, newPackages, packageInfos } = bumpInfo;

  let packages = [...modifiedPackages, ...newPackages];
  if (!validationMode) {
    // skip this step when called from `validate` since it's not needed and might be slow
    packages = toposortPackages(packages, packageInfos);
  }
  const packagesToPublish: string[] = [];
  const skippedPackageReasons: string[] = [];

  for (const pkg of packages) {
    const packageInfo = bumpInfo.packageInfos[pkg];
    const changeType = bumpInfo.calculatedChangeTypes[pkg];

    let skipReason = '';
    if (changeType === 'none') {
      skipReason = 'has change type none';
    } else if (packageInfo.private) {
      skipReason = 'is private';
    } else if (!bumpInfo.scopedPackages.has(pkg)) {
      skipReason = 'is out-of-scope';
    }

    if (skipReason) {
      skippedPackageReasons.push(`${pkg} ${skipReason}`);
    } else {
      packagesToPublish.push(pkg);
    }
  }

  // this log is not helpful when called from `validate`
  if (skippedPackageReasons.length && !validationMode) {
    console.log(`\nSkipping publishing the following packages:\n${formatList(skippedPackageReasons.sort())}`);
  }

  return packagesToPublish;
}
