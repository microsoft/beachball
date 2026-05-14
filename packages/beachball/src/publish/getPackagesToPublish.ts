import { isPackageIncluded } from '../changefile/isPackageIncluded';
import { bulletedList } from '../logging/bulletedList';
import type { PublishBumpInfo } from '../types/BumpInfo';

/**
 * Determine which of the modified/new packages in bump info should actually be published
 * (based only on the bump info, not the registry). Removes packages that are private,
 * out of scope, have change type "none", or have no calculated change type (unless they're new).
 */
export function getPackagesToPublish(
  bumpInfo: Pick<
    PublishBumpInfo,
    'modifiedPackages' | 'newPackages' | 'packageInfos' | 'calculatedChangeTypes' | 'scopedPackages'
  >,
  params?: {
    /** If true, log skipped packages and reasons */
    logSkipped?: boolean;
  }
): string[] {
  const { modifiedPackages, newPackages, packageInfos, calculatedChangeTypes, scopedPackages } = bumpInfo;

  const packages = [...modifiedPackages, ...(newPackages || [])];
  const packagesToPublish: string[] = [];
  const skippedPackageReasons: string[] = [];

  for (const pkg of packages) {
    const packageInfo = packageInfos[pkg];
    const changeType = calculatedChangeTypes[pkg];

    // It might not be possible for isPackageIncluded to return false at this point,
    // but include those checks anyway to be safe
    const { isIncluded, reason } = isPackageIncluded(packageInfo, scopedPackages);
    if (!isIncluded) {
      skippedPackageReasons.push(reason);
    } else if (changeType === 'none') {
      skippedPackageReasons.push(`${pkg} has change type "none"`);
    } else if (!changeType && !newPackages?.includes(pkg)) {
      skippedPackageReasons.push(`${pkg} is not bumped (no calculated change type)`);
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
