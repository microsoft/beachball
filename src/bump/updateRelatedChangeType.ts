import { getMaxChangeType, MinChangeType } from '../changefile/changeTypes';
import { BumpInfo } from '../types/BumpInfo';

/**
 * This is the core of the bumpInfo dependency bumping logic - done once per change file
 *
 * The algorithm is an iterative graph traversal algorithm (breadth first)
 * - it searches up the parent `dependents` and modifies the "calculatedChangeTypes" entries inside `BumpInfo`
 * - one single root entry from `pkgName` as given by a change file
 * - for all dependents
 *   - apply the `dependentChangeType` as change type
 * - this function is the primary way for package groups to get the same dependent change type by queueing up
 *   all packages within a group to be visited by the loop
 *
 * What it mutates:
 * - bumpInfo.calculatedChangeTypes: updates packages change type modifed by this function
 * - all dependents change types as part of a group update
 *
 * What it does not do:
 * - bumpInfo.calculatedChangeTypes: will not mutate the entryPoint `pkgName` change type
 *
 * Inputs from bumpInfo are listed in the [^1] below in the function body
 */
export function updateRelatedChangeType(changeFile: string, bumpInfo: BumpInfo, bumpDeps: boolean): void {
  /** [^1]: all the information needed from `bumpInfo` */
  const { calculatedChangeTypes, packageGroups, dependents, packageInfos, groupOptions } = bumpInfo;

  for (const info of bumpInfo.changeFileChangeInfos) {
    if (info.changeFile !== changeFile) {
      continue;
    }

    const {
      change: { packageName: entryPointPackageName, dependentChangeType },
    } = info;

    // Do not do anything if packageInfo is not present: it means this was an invalid changefile that
    // somehow got checked in. (This should have already been caught by readChangeFiles, but just in case.)
    if (!packageInfos[entryPointPackageName]) {
      continue;
    }

    let updatedChangeType = getMaxChangeType(dependentChangeType, MinChangeType);

    const queue = [{ subjectPackage: entryPointPackageName, changeType: MinChangeType }];

    // visited is a set of package names that already has been seen by this algorithm - this allows the algo to scale
    const visited = new Set<string>();

    while (queue.length > 0) {
      let { subjectPackage, changeType } = queue.shift()!;

      if (visited.has(subjectPackage)) {
        continue;
      }

      visited.add(subjectPackage);

      // Step 1. Update change type of the subjectPackage according to the dependent change type propagation
      const packageInfo = packageInfos[subjectPackage];
      if (!packageInfo) {
        continue;
      }

      const disallowedChangeTypes = packageInfo.combinedOptions?.disallowedChangeTypes ?? [];

      if (subjectPackage !== entryPointPackageName) {
        calculatedChangeTypes[subjectPackage] = getMaxChangeType(
          calculatedChangeTypes[subjectPackage],
          changeType,
          disallowedChangeTypes
        );
      }

      // Step 2. For all dependent packages of the current subjectPackage, place in queue to be updated at least to the "updatedChangeType"
      const dependentPackages = dependents[subjectPackage];

      if (bumpDeps && dependentPackages && dependentPackages.length > 0) {
        for (const dependentPackage of dependentPackages) {
          queue.push({
            subjectPackage: dependentPackage,
            changeType: updatedChangeType,
          });
        }
      }

      // TODO: when we do "locked", or "lock step" versioning, we could simply skip this grouped traversal,
      //       - set the version for all packages in the group in (bumpPackageInfoVersion())
      //       - the main concern is how to capture the bump reason in grouped changelog

      // Step 3. For group-linked packages, update the change type to the max(change file info's change type, propagated update change type)
      const groupName = Object.keys(packageGroups).find(group =>
        packageGroups[group].packageNames.includes(packageInfo.name)
      );

      if (groupName) {
        for (const packageNameInGroup of packageGroups[groupName].packageNames) {
          if (!groupOptions[groupName]?.disallowedChangeTypes?.includes(updatedChangeType)) {
            queue.push({
              subjectPackage: packageNameInGroup,
              changeType: updatedChangeType,
            });
          }
        }
      }
    }
  }
}
