import { BeachballOptions } from '../types/BeachballOptions';
import { BumpInfo } from '../types/BumpInfo';
import { getPackageGroups } from '../monorepo/getPackageGroups';

/**
 * Set `bumpInfo.packageGroups` and `bumpInfo.groupOptions` based on `options.groups`.
 */
export function setGroupsInBumpInfo(
  bumpInfo: Pick<BumpInfo, 'packageGroups' | 'packageInfos' | 'groupOptions'>,
  options: Pick<BeachballOptions, 'groups' | 'path'>
): void {
  if (options.groups) {
    bumpInfo.packageGroups = getPackageGroups(bumpInfo.packageInfos, options.path, options.groups);

    for (const grpName of Object.keys(bumpInfo.packageGroups)) {
      const grpOptions = options.groups.find(groupItem => groupItem.name === grpName)!;
      bumpInfo.groupOptions[grpName] = grpOptions;
    }
  }
}
