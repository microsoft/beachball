import { getMaxChangeType } from '../changefile/changeTypes';
import { getPackageOption } from '../options/getPackageOption';
import type { BeachballOptions } from '../types/BeachballOptions';
import type { BumpInfo, PackageDependents } from '../types/BumpInfo';
import type { ChangeFileInfo, ChangeType } from '../types/ChangeInfo';

/**
 * Apply `dependentChangeType` bumps (propagating through groups) and respecting `disallowedChangeTypes`
 * from repo, group, and package settings. This is only called if `bumpDeps` is true.
 *
 * The algorithm is an iterative graph traversal:
 * - One root entry: `change.packageName` with `change.dependentChangeType`
 * - For each parent in `dependents`:
 *   - Update its `calculatedChangeTypes` entry to `max(current value, change.dependentChangeType)`
 *   - Enqueue all of its dependents (if not already seen)
 * - If the package is part of a group, enqueue all packages in the group (if not already seen)
 *
 * Preconditions:
 * - `bumpInfo.calculatedChangeTypes` includes:
 *   - For non-grouped packages that have changed, the highest change type from any change file
 *   - For each grouped package where anything in the group has changed, the highest change type
 *     from any change file in the group
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
  dependents: PackageDependents;
  options: Pick<BeachballOptions, 'disallowedChangeTypes'>;
  /** Cached package name to group name mapping for quick lookup */
  packageToGroup: Record<string, string>;
}): void {
  const { change, bumpInfo, dependents, packageToGroup } = params;
  const { calculatedChangeTypes, packageGroups, packageInfos } = bumpInfo;

  // If dependentChangeType is none (or somehow unset), there's nothing to do.
  if (getMaxChangeType([change.dependentChangeType]) === 'none') {
    return;
  }

  // Enqueue the first package. (dependentChangeType in the queue is usually the same as from the
  // change file, but for packages in a group with disallowedChangeTypes, it might have been downgraded.)
  //
  // WARNING: This part of the bump algorithm is a performance bottleneck, so it's important to bail early
  // whenever possible, and to use `seen` to reduce queue insertion.
  // https://github.com/microsoft/beachball/pull/1042
  type SeenKey = `${string}#${ChangeType}`;
  const seen = new Set<SeenKey>();
  const seenGroups = new Set<SeenKey>();
  const queue: Array<{ subjectPackage: string; dependentChangeType: ChangeType }> = [
    { subjectPackage: change.packageName, dependentChangeType: change.dependentChangeType },
  ];
  const startKey: SeenKey = `${change.packageName}#${change.dependentChangeType}`;

  while (queue.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const { subjectPackage, dependentChangeType } = queue.shift()!;
    const queueKey: SeenKey = `${subjectPackage}#${dependentChangeType}`;

    // Step 1. Update change type of the subjectPackage according to dependentChangeType if needed.
    // Also update members of its group if applicable.
    // (Skip the initial package since dependentChangeType doesn't apply there.)
    if (queueKey !== startKey) {
      const groupName = packageToGroup[subjectPackage];
      const group = groupName ? packageGroups[groupName] : undefined;

      const oldType = calculatedChangeTypes[subjectPackage];
      const newType = (calculatedChangeTypes[subjectPackage] = getMaxChangeType(
        [oldType, dependentChangeType],
        // Group disallowedChangeTypes take precedence (actually validation verifies both can't be set)
        // TODO: it's probably better to just save the disallowedChangeTypes with each grouped package during setup?
        group?.disallowedChangeTypes === null
          ? null
          : group?.disallowedChangeTypes ||
              getPackageOption('disallowedChangeTypes', packageInfos[subjectPackage], params.options)
      ));

      if (newType === oldType) {
        // We didn't change this type, so keep going.
        continue;
      }

      // If this package is in a group, enqueue other packages in the group.
      // (Use an extra set tracking groups to avoid iterating over all member packages.)
      const groupKey = groupName ? (`${groupName}#${dependentChangeType}` as const) : undefined;
      if (group && groupKey && !seenGroups.has(groupKey)) {
        seenGroups.add(groupKey);
        for (const packageNameInGroup of group.packageNames) {
          const key: SeenKey = `${packageNameInGroup}#${dependentChangeType}`;
          if (!seen.has(key)) {
            seen.add(key);
            queue.push({ subjectPackage: packageNameInGroup, dependentChangeType: newType });
          }
        }
      }
    }

    // Step 2. For all dependent packages of the current subjectPackage, place in queue to be
    // updated at least to the dependentChangeType
    for (const dependentPackage of dependents[subjectPackage] || []) {
      const key: SeenKey = `${dependentPackage}#${dependentChangeType}`;
      if (!seen.has(key)) {
        seen.add(key);
        queue.push({ subjectPackage: dependentPackage, dependentChangeType });
      }
    }
  }
}
