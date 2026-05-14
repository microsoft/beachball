import { bulletedList } from '../logging/bulletedList';
import type { BumpInfo } from '../types/BumpInfo';

/**
 * Determine which of the modified packages in bump info should actually be published
 * (based only on the bump info, not the registry). Removes packages that are private,
 * out of scope, have change type "none", or have no calculated change type.
 */
export function getPackagesToPublish(
  bumpInfo: Pick<BumpInfo, 'modifiedPackages' | 'packageInfos' | 'calculatedChangeTypes' | 'scopedPackages'>,
  params?: {
    /** If true, log skipped packages and reasons */
    logSkipped?: boolean;
    /** If true, filter out packages with beachball.shouldPublish=false */
    respectShouldPublish?: boolean;
  }
): string[] {
  const { modifiedPackages, packageInfos, calculatedChangeTypes, scopedPackages } = bumpInfo;

  const packagesToPublish: string[] = [];
  const skippedPackageReasons: string[] = [];

  for (const pkg of modifiedPackages) {
    const packageInfo = packageInfos[pkg];
    const changeType = calculatedChangeTypes[pkg];

    let skipReason = '';
    if (changeType === 'none') {
      skipReason = 'has change type none';
    } else if (packageInfo.private) {
      skipReason = 'is private';
    } else if (!scopedPackages.has(pkg)) {
      skipReason = 'is out-of-scope';
    } else if (!changeType) {
      skipReason = 'is not bumped (no calculated change type)';
    } else if (params?.respectShouldPublish && packageInfo.packageOptions?.shouldPublish === false) {
      skipReason = 'has beachball.shouldPublish=false';
    }

    if (skipReason) {
      skippedPackageReasons.push(`${pkg} ${skipReason}`);
    } else {
      packagesToPublish.push(pkg);
    }
  }

  // this log is not helpful when called from `validate`
  if (skippedPackageReasons.length && params?.logSkipped) {
    console.log(`Skipping publishing the following packages:\n${bulletedList(skippedPackageReasons.sort())}\n`);
  }

  return packagesToPublish;
}
