import { getMaxChangeType } from '../changefile/getPackageChangeTypes';
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
  const { packageChangeTypes, packageGroups, dependents, packageInfos } = bumpInfo;

  // Prevent any more work if there are no changes to the changeType
  let maxChangeType = packageChangeTypes[pkgName];
  maxChangeType = getMaxChangeType(changeType, maxChangeType);

  // Handle groups
  packageChangeTypes[pkgName] = maxChangeType;

  if (packageInfos[pkgName].group) {
    console.log(packageGroups[packageInfos[pkgName].group!]);

    packageGroups[packageInfos[pkgName].group!].forEach(groupPkgName => {
      maxChangeType = getMaxChangeType(maxChangeType, packageChangeTypes[groupPkgName]);
    });

    packageGroups[packageInfos[pkgName].group!].forEach(groupPkgName => {
      if (packageChangeTypes[groupPkgName] !== maxChangeType) {
        updateRelatedChangeType(groupPkgName, maxChangeType, bumpInfo, bumpDeps);
      }
    });
  }

  if (bumpDeps) {
    // Change dependents
    const dependentPackages = dependents[pkgName];
    if (dependentPackages) {
      dependentPackages.forEach(parent => {
        if (packageChangeTypes[parent] !== maxChangeType) {
          updateRelatedChangeType(parent, maxChangeType, bumpInfo, bumpDeps);
        }
      });
    }
  }
}
