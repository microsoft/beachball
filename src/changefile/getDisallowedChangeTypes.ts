import type { ChangeType } from '../types/ChangeInfo';
import type { DeepReadonly } from '../types/DeepReadonly';
import type { PackageGroups, PackageInfos } from '../types/PackageInfo';

export function getDisallowedChangeTypes(
  packageName: string,
  packageInfos: PackageInfos,
  packageGroups: DeepReadonly<PackageGroups>
): ReadonlyArray<ChangeType> | null {
  for (const group of Object.values(packageGroups)) {
    if (group.packageNames.includes(packageName)) {
      return group.disallowedChangeTypes || null;
    }
  }
  return packageInfos[packageName]?.combinedOptions.disallowedChangeTypes || null;
}
