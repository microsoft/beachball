import { getMaxChangeType, getAllowedChangeType } from '../changefile/getPackageChangeTypes';
import { ChangeType } from '../types/ChangeInfo';
import { BumpInfo } from '../types/BumpInfo';

/**
 * Updates package change types based on dependents (e.g given A -> B, if B has a minor change, A should also have minor change)
 *
 * This function is recursive and will futher call itself to update related dependent packages noting groups and bumpDeps flag
 *
 * @param pkgName
 * @param changeType
 * @param bumpInfo
 * @param dependents
 */
export function updateRelatedChangeType(
  pkgName: string,
  changeType: ChangeType,
  bumpInfo: BumpInfo,
  bumpDeps: boolean
) {
  const { packageChangeTypes, packageGroups, dependents, packageInfos, dependentChangeTypes } = bumpInfo;

  const disallowedChangeTypes = packageInfos[pkgName].options.disallowedChangeTypes;

  let depChangeType = getAllowedChangeType(dependentChangeTypes[pkgName], disallowedChangeTypes);

  // Handle groups
  packageChangeTypes[pkgName] = getMaxChangeType(changeType, packageChangeTypes[pkgName], disallowedChangeTypes);

  if (packageInfos[pkgName].group) {
    let maxGroupChangeType = depChangeType;

    // calculate maxChangeType
    packageGroups[packageInfos[pkgName].group!].forEach(groupPkgName => {
      maxGroupChangeType = getMaxChangeType(
        maxGroupChangeType,
        packageChangeTypes[groupPkgName],
        disallowedChangeTypes
      );
    });

    packageGroups[packageInfos[pkgName].group!].forEach(groupPkgName => {
      if (packageChangeTypes[groupPkgName] !== maxGroupChangeType) {
        updateRelatedChangeType(groupPkgName, maxGroupChangeType, bumpInfo, bumpDeps);
      }
    });
  }

  if (bumpDeps) {
    // Change dependents
    const dependentPackages = dependents[pkgName];
    if (dependentPackages) {
      dependentPackages.forEach(parent => {
        if (packageChangeTypes[parent] !== depChangeType) {
          updateRelatedChangeType(parent, depChangeType, bumpInfo, bumpDeps);
        }
      });
    }
  }
}
