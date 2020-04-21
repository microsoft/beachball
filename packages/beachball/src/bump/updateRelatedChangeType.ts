import { getMaxChangeType, MinChangeType } from '../changefile/getPackageChangeTypes';
import { ChangeType } from '../types/ChangeInfo';
import { BumpInfo } from '../types/BumpInfo';

/**
 * Updates package change types based on dependents (e.g given A -> B, if B has a minor change, A should also have minor change)
 *
 * This function is recursive and will futher call itself to update related dependent packages noting groups and bumpDeps flag
 */
export function updateRelatedChangeType(
  pkgName: string,
  changeType: ChangeType,
  bumpInfo: BumpInfo,
  bumpDeps: boolean
) {
  const { packageChangeTypes, packageGroups, dependents, packageInfos, dependentChangeTypes, groupOptions } = bumpInfo;

  const disallowedChangeTypes = packageInfos[pkgName].options?.disallowedChangeTypes ?? [];

  let depChangeType = getMaxChangeType(MinChangeType, dependentChangeTypes[pkgName], disallowedChangeTypes);
  let dependentPackages = dependents[pkgName];

  // Handle groups
  packageChangeTypes[pkgName] = getMaxChangeType(changeType, packageChangeTypes[pkgName], disallowedChangeTypes);

  const groupName = packageInfos[pkgName].group;
  if (groupName) {
    let maxGroupChangeType: ChangeType = MinChangeType;

    // calculate maxChangeType
    packageGroups[groupName].packageNames.forEach(groupPkgName => {
      maxGroupChangeType = getMaxChangeType(
        maxGroupChangeType,
        packageChangeTypes[groupPkgName],
        groupOptions[groupName]?.disallowedChangeTypes
      );

      // disregard the target disallowed types for now and will be culled at the subsequent update steps
      dependentChangeTypes[groupPkgName] = getMaxChangeType(depChangeType, dependentChangeTypes[groupPkgName], []);
    });

    packageGroups[groupName].packageNames.forEach(groupPkgName => {
      if (packageChangeTypes[groupPkgName] !== maxGroupChangeType) {
        updateRelatedChangeType(groupPkgName, maxGroupChangeType, bumpInfo, bumpDeps);
      }
    });
  }

  if (bumpDeps && dependentPackages) {
    new Set(dependentPackages).forEach(parent => {
      if (packageChangeTypes[parent] !== depChangeType) {
        // propagate the dependentChangeType of the current package to the subsequent related packages
        dependentChangeTypes[parent] = depChangeType;

        updateRelatedChangeType(parent, depChangeType, bumpInfo, bumpDeps);
      }
    });
  }
}
