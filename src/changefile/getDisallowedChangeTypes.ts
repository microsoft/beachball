import type { ChangeType } from '../types/ChangeInfo';
import type { PackageGroups, PackageInfos } from '../types/PackageInfo';

/**
 * Get `disallowedChangeTypes` from the package's group if relevant.
 * Otherwise, get it from the package's own config or the repo config.
 */
// TODO: merge this in getPackageInfosWithOptions instead
export function getDisallowedChangeTypes(
  packageName: string,
  packageInfos: PackageInfos,
  packageGroups: PackageGroups
): ChangeType[] | null {
  for (const group of Object.values(packageGroups)) {
    if (group.packageNames.includes(packageName)) {
      return group.disallowedChangeTypes || null;
    }
  }
  return packageInfos[packageName]?.combinedOptions.disallowedChangeTypes || null;
}
