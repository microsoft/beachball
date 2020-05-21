import { ChangeType } from '../types/ChangeInfo';
import { PackageGroups, PackageInfos } from '../types/PackageInfo';
export function getDisallowedChangeTypes(
  packageName: string,
  packageInfos: PackageInfos,
  packageGroups: PackageGroups
): ChangeType[] | null {
  for (const groupName of Object.keys(packageGroups)) {
    const groupsInfo = packageGroups[groupName];
    if (groupsInfo.packageNames.indexOf(packageName) > -1) {
      return groupsInfo.disallowedChangeTypes;
    }
  }
  return packageInfos[packageName].options.disallowedChangeTypes;
}
