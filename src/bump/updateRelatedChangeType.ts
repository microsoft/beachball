import { MinChangeType, updateChangeInfoWithMaxType } from '../changefile/getPackageChangeTypes';
import { BumpInfo } from '../types/BumpInfo';
import { ChangeInfo, ChangeType } from '../types/ChangeInfo';

export function updateRelatedChangeType(pkgName: string, bumpInfo: BumpInfo, bumpDeps: boolean) {
  if (!bumpDeps) {
    return;
  }

  const {
    calculatedChangeInfos,
    changeFileChangeInfos,
    packageGroups,
    dependents,
    packageInfos,
    dependentChangeInfos,
    dependentChangeTypes,
    groupOptions,
  } = bumpInfo;

  const packageInfo = packageInfos[pkgName];
  const dependentChangeType = dependentChangeTypes[pkgName];
  const disallowedChangeTypes = packageInfo.combinedOptions?.disallowedChangeTypes ?? [];
  let baseChangeInfo = {
    ...changeFileChangeInfos.get(pkgName),
    ...dependentChangeInfos[pkgName],
    ...calculatedChangeInfos[pkgName],
  };
  const queue = [{ subjectPackage: pkgName, baseChangeInfo }];

  // visited is a set of package names
  const visited = new Set<string>();

  while (queue.length > 0) {
    let { subjectPackage, baseChangeInfo } = queue.shift()!;

    if (!visited.has(subjectPackage)) {
      visited.add(subjectPackage);

      if (subjectPackage !== pkgName) {
        baseChangeInfo = createOrUpdateChangeInfo(subjectPackage, dependentChangeType, baseChangeInfo);
      }

      const dependentPackages = dependents[subjectPackage];

      if (dependentPackages && dependentPackages.length > 0) {
        for (const dependentPackage of dependentPackages) {
          queue.push({ subjectPackage: dependentPackage, baseChangeInfo });
        }
      }

      // handle the group dependent updates
      const groupName = packageInfos[subjectPackage].group;

      if (groupName) {
        for (const packageNameInGroup of packageGroups[groupName].packageNames) {
          if (
            !groupOptions[groupName] ||
            !groupOptions[groupName]?.disallowedChangeTypes?.includes(dependentChangeType)
          ) {
            queue.push({ subjectPackage: packageNameInGroup, baseChangeInfo });
          }
        }
      }
    }
  }

  function createOrUpdateChangeInfo(pkg: string, dependentChangeType: ChangeType, changeInfo: ChangeInfo) {
    const newChangeInfo = {
      type: MinChangeType,
      packageName: pkg,
      email: changeInfo.email,
      commit: changeInfo.commit,
      comment: '', // comment will be populated at later stages when new versions are computed
      dependentChangeType: MinChangeType,
    };

    if (!calculatedChangeInfos[pkg]) {
      // for packages previously unseen, initialize with the dependentChangeType unless it is disallowed
      calculatedChangeInfos[pkg] = updateChangeInfoWithMaxType(
        newChangeInfo,
        newChangeInfo.dependentChangeType,
        dependentChangeType,
        disallowedChangeTypes
      );
    } else {
      // for packages already in calculatedChangeInfos, do max type calculation between existing type with dependentChangeType
      calculatedChangeInfos[pkg] = updateChangeInfoWithMaxType(
        newChangeInfo,
        calculatedChangeInfos[pkg].type,
        dependentChangeType,
        disallowedChangeTypes
      );
    }

    dependentChangeInfos[pkg] = calculatedChangeInfos[pkg];
    return calculatedChangeInfos[pkg];
  }
}

// /**
//  * Updates package change types based on dependents (e.g given A -> B, if B has a minor change, A should also have minor change)
//  *
//  * This function is recursive and will futher call itself to update related dependent packages noting groups and bumpDeps flag
//  */
// export function updateRelatedChangeType2(
//   pkgName: string,
//   changeInfo: ChangeInfo,
//   bumpInfo: BumpInfo,
//   dependentChangeInfos: Map<string, Map<string, ChangeInfo>>,
//   bumpDeps: boolean
// ) {
//   const {
//     calculatedChangeInfo: packageChangeTypes,
//     packageGroups,
//     dependents,
//     packageInfos,
//     dependentChangeTypes,
//     groupOptions,
//   } = bumpInfo;

//   const packageInfo = packageInfos[pkgName];
//   const disallowedChangeTypes = packageInfo.combinedOptions?.disallowedChangeTypes ?? [];

//   let depChangeInfo = updateChangeInfoWithMaxType(
//     changeInfo,
//     MinChangeType,
//     dependentChangeTypes[pkgName],
//     disallowedChangeTypes
//   );

//   let dependentPackages = dependents[pkgName];

//   // Handle groups
//   packageChangeTypes[pkgName] = updateChangeInfoWithMaxType(
//     packageChangeTypes[pkgName],
//     changeInfo.type,
//     packageChangeTypes[pkgName]?.type,
//     disallowedChangeTypes
//   );

//   const groupName = packageInfos[pkgName].group;
//   if (groupName) {
//     let groupChangeInfo: ChangeInfo = {
//       ...changeInfo,
//       type: MinChangeType,
//     };

//     // calculate maxChangeType
//     packageGroups[groupName].packageNames.forEach(groupPkgName => {
//       groupChangeInfo = {
//         ...groupChangeInfo,
//         type: getMaxChangeType(
//           groupChangeInfo.type,
//           packageChangeTypes[groupPkgName]?.type,
//           groupOptions[groupName]?.disallowedChangeTypes
//         ),
//       };

//       // disregard the target disallowed types for now and will be culled at the subsequent update steps
//       dependentChangeTypes[groupPkgName] = getMaxChangeType(depChangeInfo.type, dependentChangeTypes[groupPkgName], []);
//     });

//     packageGroups[groupName].packageNames.forEach(groupPkgName => {
//       if (packageChangeTypes[groupPkgName]?.type !== groupChangeInfo.type) {
//         updateRelatedChangeType2(groupPkgName, groupChangeInfo, bumpInfo, dependentChangeInfos, bumpDeps);
//       }
//     });
//   }

//   if (bumpDeps && dependentPackages) {
//     new Set(dependentPackages).forEach(parent => {
//       if (packageChangeTypes[parent]?.type !== depChangeInfo.type) {
//         // propagate the dependentChangeType of the current package to the subsequent related packages
//         dependentChangeTypes[parent] = depChangeInfo.type;

//         let changeInfos = dependentChangeInfos.get(pkgName);
//         if (!changeInfos) {
//           changeInfos = new Map<string, ChangeInfo>();
//           dependentChangeInfos.set(pkgName, changeInfos);
//         }

//         let prevChangeInfo = changeInfos.get(parent);
//         let nextChangeInfo: ChangeInfo = {
//           type: depChangeInfo.type,
//           packageName: parent,
//           email: depChangeInfo.email,
//           commit: depChangeInfo.commit,
//           comment: '', // comment will be populated at later stages when new versions are computed
//           dependentChangeType: depChangeInfo.type,
//         };

//         if (prevChangeInfo) {
//           nextChangeInfo = {
//             ...nextChangeInfo,
//             type: getMaxChangeType(prevChangeInfo.type, nextChangeInfo.type, disallowedChangeTypes),
//           };
//         }

//         changeInfos.set(parent, nextChangeInfo);
//         updateRelatedChangeType2(parent, depChangeInfo, bumpInfo, dependentChangeInfos, bumpDeps);
//       }
//     });
//   }
// }
