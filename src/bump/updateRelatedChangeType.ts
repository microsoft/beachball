import { getMaxChangeType, MinChangeType } from '../changefile/getPackageChangeTypes';
import { BumpInfo } from '../types/BumpInfo';
import { ChangeInfo } from '../types/ChangeInfo';

/**
 * Updates package change types based on dependents (e.g given A -> B, if B has a minor change, A should also have minor change)
 *
 * This function is recursive and will futher call itself to update related dependent packages noting groups and bumpDeps flag
 */
export function updateRelatedChangeType(
  pkgName: string,
  changeType: ChangeInfo,
  bumpInfo: BumpInfo,
  dependentChangeInfos: Map<string, Array<ChangeInfo>>,
  bumpDeps: boolean
) {
  const { packageChangeTypes, packageGroups, dependents, packageInfos, dependentChangeTypes, groupOptions } = bumpInfo;

  const packageInfo = packageInfos[pkgName];
  const disallowedChangeTypes = packageInfo.combinedOptions?.disallowedChangeTypes ?? [];

  let depChangeType = {
    ...changeType,
    type: getMaxChangeType(MinChangeType, dependentChangeTypes[pkgName], disallowedChangeTypes),
  };

  let dependentPackages = dependents[pkgName];

  // Handle groups
  packageChangeTypes[pkgName] = {
    ...packageChangeTypes[pkgName],
    type: getMaxChangeType(changeType.type, packageChangeTypes[pkgName]?.type, disallowedChangeTypes),
  };

  const groupName = packageInfos[pkgName].group;
  if (groupName) {
    let maxGroupChangeType: ChangeInfo = {
      ...changeType,
      type: MinChangeType,
    };

    // calculate maxChangeType
    packageGroups[groupName].packageNames.forEach(groupPkgName => {
      maxGroupChangeType = {
        ...maxGroupChangeType,
        type: getMaxChangeType(
          maxGroupChangeType.type,
          packageChangeTypes[groupPkgName]?.type,
          groupOptions[groupName]?.disallowedChangeTypes
        ),
      };

      // disregard the target disallowed types for now and will be culled at the subsequent update steps
      dependentChangeTypes[groupPkgName] = getMaxChangeType(depChangeType.type, dependentChangeTypes[groupPkgName], []);
    });

    packageGroups[groupName].packageNames.forEach(groupPkgName => {
      if (packageChangeTypes[groupPkgName]?.type !== maxGroupChangeType.type) {
        updateRelatedChangeType(groupPkgName, maxGroupChangeType, bumpInfo, dependentChangeInfos, bumpDeps);
      }
    });
  }

  if (bumpDeps && dependentPackages) {
    new Set(dependentPackages).forEach(parent => {
      if (packageChangeTypes[parent]?.type !== depChangeType.type) {
        // propagate the dependentChangeType of the current package to the subsequent related packages
        dependentChangeTypes[parent] = depChangeType.type;

        let changeInfos = dependentChangeInfos.get(pkgName);
        if (!changeInfos) {
          changeInfos = new Array<ChangeInfo>();
          dependentChangeInfos.set(pkgName, changeInfos);
        }

        changeInfos.push({
          type: depChangeType.type,
          packageName: parent,
          email: depChangeType.email,
          dependentChangeType: depChangeType.type,
          commit: depChangeType.commit,
          comment: '', // comment will be populated at later stages when new versions are computed
        });

        updateRelatedChangeType(parent, depChangeType, bumpInfo, dependentChangeInfos, bumpDeps);
      }
    });
  }
}
