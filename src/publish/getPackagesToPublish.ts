import { formatList } from '../logging/format';
import type { PublishBumpInfo } from '../types/BumpInfo';

/**
 * Determine which of the modified/new packages in bump info should actually be published
 * (based only on the bump info, not the registry).
 *
 * (Note: previously this would toposort the packages, but now that's handle by p-graph
 * concurrency orchestration.)
 * @param validationMode - if true, don't log skipped packages
 */
export function getPackagesToPublish(bumpInfo: PublishBumpInfo, validationMode?: boolean): string[] {
  const { modifiedPackages, newPackages, packageInfos, calculatedChangeTypes, scopedPackages } = bumpInfo;

  const packages = [...modifiedPackages, ...(newPackages || [])];
  const packagesToPublish: string[] = [];
  const skippedPackageReasons: string[] = [];

  for (const pkg of packages) {
    const packageInfo = packageInfos[pkg];
    const changeType = calculatedChangeTypes[pkg];

    let skipReason = '';
    if (changeType === 'none') {
      skipReason = 'has change type none';
    } else if (packageInfo.private) {
      skipReason = 'is private';
    } else if (!scopedPackages.has(pkg)) {
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
