import { BeachballOptions } from '../types/BeachballOptions';
import { BumpInfo } from '../types/BumpInfo';
import { getPackageGroups } from '../monorepo/getPackageGroups';

export function setGroupsInBumpInfo(bumpInfo: BumpInfo, options: BeachballOptions) {
  bumpInfo.packageGroups = getPackageGroups(bumpInfo.packageInfos, options.path, options.groups);

  if (options.groups) {
    for (const grpName of Object.keys(bumpInfo.packageGroups)) {
      const grpOptions = options.groups.find(groupItem => groupItem.name === grpName)!;
      bumpInfo.groupOptions[grpName] = grpOptions;
    }
  }
}
