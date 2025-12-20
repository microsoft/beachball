import { bulletedList } from '../logging/bulletedList';
import type { BeachballOptions } from '../types/BeachballOptions';
import type { PublishBumpInfo } from '../types/BumpInfo';
import { toposortPackages } from './toposortPackages';

/**
 * Determine which of the modified/new packages in bump info should actually be published
 * (based only on the bump info, not the registry).
 */
export function getPackagesToPublish(
  bumpInfo: Pick<
    PublishBumpInfo,
    'modifiedPackages' | 'newPackages' | 'packageInfos' | 'calculatedChangeTypes' | 'scopedPackages'
  >,
  options: Pick<BeachballOptions, 'bump'>,
  params?: {
    /** If true, topologically sort the package names based on the dependency graph (may be slow) */
    toposort?: boolean;
    /** If true, log skipped packages and reasons */
    logSkipped?: boolean;
  }
): string[] {
  const { modifiedPackages, newPackages, packageInfos, calculatedChangeTypes, scopedPackages } = bumpInfo;

  let packages = [...modifiedPackages, ...(newPackages || [])];
  if (params?.toposort) {
    packages = toposortPackages(packages, packageInfos);
  }
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
    } else if (!scopedPackages.allInScope && !scopedPackages.has(pkg)) {
      skipReason = 'is out-of-scope';
    } else if (options.bump && !changeType && !newPackages?.includes(pkg)) {
      // bump=false is the only time when this might be valid, but that behavior needs more thought...
      // TODO: remove `options.bump` exception and/or figure out how it should actually be handled
      // https://github.com/microsoft/beachball/issues/1125
      skipReason = 'is not bumped (no calculated change type)';
    }

    if (skipReason) {
      skippedPackageReasons.push(`${pkg} ${skipReason}`);
    } else {
      packagesToPublish.push(pkg);
    }
  }

  // this log is not helpful when called from `validate`
  if (skippedPackageReasons.length && params?.logSkipped) {
    console.log(`\nSkipping publishing the following packages:\n${bulletedList(skippedPackageReasons.sort())}`);
  }

  return packagesToPublish;
}
