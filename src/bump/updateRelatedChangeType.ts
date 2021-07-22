import { MinChangeType, updateChangeInfoWithMaxType } from '../changefile/getPackageChangeTypes';
import { BumpInfo } from '../types/BumpInfo';
import { ChangeInfo, ChangeType } from '../types/ChangeInfo';

/**
 * This is the core of the bumpInfo dependency bumping logic
 *
 * The algorithm is an iterative graph traversal algorithm (breadth first)
 * - it searches up the parent `dependents` and creates ChangeInfo entries inside `dependentChangeInfos`
 * - one single root entry from `pkgName`
 * - for all dependents
 *   - apply the `dependentChangeType` as change type in the ChangeInfo
 *   - copy the `commit`, `email` from child (dependency) to parent (dependent)
 * - this function is the primary way for package groups to get the same change type by queueing up
 *   all packages within a group to be visited by the loop
 *
 * What is mutates:
 * - bumpInfo.calculatedChangeInfos: adds packages changeInfo modifed by this function
 * - bumpInfo.dependentChangeInfos: copy of what has been added in `calculatedChangeInfos`
 *
 * What it does not do:
 * - bumpInfo.calculatedChangeInfos: will not mutate the entryPoint `pkgName` ChangeInfo
 * - bumpInfo.dependentChangeInfos: will not contain the ChangeInfo for `pkgName` at all
 *
 * Inputs from bumpInfo are listed in the [^1] below in the function body
 *
 * @param entryPointPackageName
 * @param bumpInfo
 * @param bumpDeps
 * @returns
 */
export function updateRelatedChangeType(
  changeFile: string,
  entryPointPackageName: string,
  bumpInfo: BumpInfo,
  bumpDeps: boolean
) {
  /** [^1]: all the information needed from `bumpInfo` */
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

  // Do not do anything if packageInfo is not present: it means this was an invalid changefile that somehow got checked in
  if (!packageInfos[entryPointPackageName]) {
    return;
  }

  const dependentChangeType = dependentChangeTypes[entryPointPackageName];

  let baseChangeInfo = {
    ...changeFileChangeInfos.get(changeFile),
    ...dependentChangeInfos[entryPointPackageName],
    ...calculatedChangeInfos[entryPointPackageName],
  };

  const queue = [{ subjectPackage: entryPointPackageName, changeType: MinChangeType, baseChangeInfo }];

  // visited is a set of package names that already has been seen by this algorithm - this allows the algo to scale
  const visited = new Set<string>();

  while (queue.length > 0) {
    let { subjectPackage, changeType, baseChangeInfo } = queue.shift()!;

    if (!visited.has(subjectPackage)) {
      visited.add(subjectPackage);

      const packageInfo = packageInfos[subjectPackage];

      if (!packageInfo) {
        continue;
      }

      const disallowedChangeTypes = packageInfo.combinedOptions?.disallowedChangeTypes ?? [];

      if (subjectPackage !== entryPointPackageName) {
        baseChangeInfo = createOrUpdateChangeInfo(subjectPackage, changeType, baseChangeInfo, disallowedChangeTypes);
      }

      const dependentPackages = dependents[subjectPackage];

      if (bumpDeps && dependentPackages && dependentPackages.length > 0) {
        for (const dependentPackage of dependentPackages) {
          queue.push({
            subjectPackage: dependentPackage,
            changeType: dependentChangeType,
            baseChangeInfo,
          });
        }
      }

      // handle the group dependent updates
      const groupName = packageInfo.group;

      if (groupName) {
        for (const packageNameInGroup of packageGroups[groupName].packageNames) {
          if (
            !groupOptions[groupName] ||
            !groupOptions[groupName]?.disallowedChangeTypes?.includes(dependentChangeType)
          ) {
            queue.push({
              subjectPackage: packageNameInGroup,
              changeType: baseChangeInfo.type,
              baseChangeInfo,
            });
          }
        }
      }
    }
  }

  function createOrUpdateChangeInfo(
    pkg: string,
    changeType: ChangeType,
    changeInfo: ChangeInfo,
    disallowedChangeTypes: ChangeType[]
  ) {
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
        changeType,
        disallowedChangeTypes
      );
    } else {
      // for packages already in calculatedChangeInfos, do max type calculation between existing type with dependentChangeType
      calculatedChangeInfos[pkg] = updateChangeInfoWithMaxType(
        newChangeInfo,
        calculatedChangeInfos[pkg].type,
        changeType,
        disallowedChangeTypes
      );
    }

    dependentChangeInfos[pkg] = calculatedChangeInfos[pkg];
    return calculatedChangeInfos[pkg];
  }
}
