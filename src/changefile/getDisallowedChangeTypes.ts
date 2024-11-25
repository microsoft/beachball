import type { ChangeType } from '../types/ChangeInfo';
import type { PackageGroups, PackageInfos } from '../types/PackageInfo';

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
