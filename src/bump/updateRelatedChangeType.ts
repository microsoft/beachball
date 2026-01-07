import { getMaxChangeType } from '../changefile/changeTypes';
import { getPackageOption } from '../options/getPackageOption';
import type { BeachballOptions } from '../types/BeachballOptions';
import type { BumpInfo, PackageDependents } from '../types/BumpInfo';
import { ChangeFileInfo } from '../types/ChangeInfo';

/**
 * This is the core of the `bumpInfo` dependency bumping logic - done once per change info.
 *
 * The algorithm is an iterative graph traversal algorithm (breadth first):
 * - One root entry: `change.packageName`
 * - For each parent in `dependents`:
 *   - Update its `calculatedChangeTypes` entry to `max(current value, change.dependentChangeType)`
 *   - Enqueue all of its dependents to be seen
 * - If the package is part of a group, enqueue all packages in the group
 *
 * Preconditions:
 * - `bumpInfo.calculatedChangeTypes` includes:
 *   - For non-grouped packages that have changed, the highest change type from any change file
 *   - For each grouped package where anything in the group has changed, the highest change type
 *     from any change file in the group
 * - `dependents` is undefined if `BeachballOptions.bumpDeps` was false
 *
 * What it mutates:
 * - `bumpInfo.calculatedChangeTypes`: update change type for package and dependents
 * - all dependents' change types as part of a group update
 *
 * What it does not do:
 * - `bumpInfo.calculatedChangeTypes`: will not mutate the `change.packageName` change type
 */
export function updateRelatedChangeType(params: {
  change: ChangeFileInfo;
  bumpInfo: Pick<BumpInfo, 'calculatedChangeTypes' | 'packageGroups' | 'packageInfos'>;
  dependents: PackageDependents | undefined;
  options: Pick<BeachballOptions, 'disallowedChangeTypes'>;
}): void {
  const { change, bumpInfo, dependents } = params;
  const { calculatedChangeTypes, packageGroups, packageInfos } = bumpInfo;

  // If dependentChangeType is none (or somehow unset), there's nothing to do.
  const dependentChangeType = getMaxChangeType([change.dependentChangeType]);
  if (dependentChangeType === 'none') {
    return;
  }

  // Enqueue the first package.
  // This part of the bump algorithm is a performance bottleneck, so it's important to bail early
  // whenever possible, and to use `seen` to reduce queue insertion.
  // https://github.com/microsoft/beachball/pull/1042
  const queue = [change.packageName];
  const seen = new Set<string>();

  while (queue.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const subjectPackage = queue.shift()!;

    // Step 1. Update change type of the subjectPackage according to dependentChangeType if needed.
    // (Skip for the initial package.)
    if (subjectPackage !== change.packageName) {
      const oldType = calculatedChangeTypes[subjectPackage];
      calculatedChangeTypes[subjectPackage] = getMaxChangeType(
        [oldType, dependentChangeType],
        getPackageOption('disallowedChangeTypes', packageInfos[subjectPackage], params.options)
      );

      // TODO: what's the interaction with groups here?
      if (calculatedChangeTypes[subjectPackage] === oldType) {
        // We didn't change this type, so keep going.
        continue;
      }
    }

    // Step 2. For all dependent packages of the current subjectPackage, place in queue to be updated at least to the "updatedChangeType"
    // (dependents will be undefined if bumpDeps was false)
    const dependentPackages = dependents?.[subjectPackage];

    if (dependentPackages?.length) {
      for (const dependentPackage of dependentPackages) {
        if (seen.has(dependentPackage)) {
          continue;
        }

        seen.add(dependentPackage);
        queue.push(dependentPackage);
      }
    }

    // TODO: when we do "locked", or "lock step" versioning, we could simply skip this grouped traversal,
    //       - set the version for all packages in the group in bumpPackageInfoVersion()
    //       - the main concern is how to capture the bump reason in grouped changelog

    // Step 3. For group-linked packages, update the change type to the max(change file info's change type, propagated update change type)
    // TODO: ensure this is consistent with other group handling, and whether it's necessary at all if bumpDeps is false
    const group = Object.values(packageGroups).find(g => g.packageNames.includes(subjectPackage));

    if (group && !group.disallowedChangeTypes?.includes(dependentChangeType)) {
      for (const packageNameInGroup of group.packageNames) {
        if (!seen.has(packageNameInGroup)) {
          seen.add(packageNameInGroup);
          queue.push(packageNameInGroup);
        }
      }
    }
  }
}
