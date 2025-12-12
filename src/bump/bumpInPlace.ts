import type { BumpInfo } from '../types/BumpInfo';
import { getDependentsForPackages } from './getDependentsForPackages';
import { updateRelatedChangeType } from './updateRelatedChangeType';
import { bumpPackageInfoVersion } from './bumpPackageInfoVersion';
import type { BeachballOptions } from '../types/BeachballOptions';
import { setDependentVersions } from './setDependentVersions';
import { getMaxChangeType } from '../changefile/changeTypes';
import { ChangeType } from '../types/ChangeInfo';

/**
 * Updates BumpInfo according to change types, bump deps, and version groups
 *
 * NOTE: THIS FUNCTION MUTATES STATE!
 */
export function bumpInPlace(bumpInfo: BumpInfo, options: BeachballOptions): void {
  const { bumpDeps } = options;
  // Precondition (pass 1): calculatedChangeTypes includes ONLY changes direct from the change files
  // (no dependents or groups)
  const { calculatedChangeTypes, changeFileChangeInfos } = bumpInfo;

  // TODO: when we do "locked", or "lock step" versioning, we could simply skip setting grouped change types
  //       - set the version for all packages in the group in (bumpPackageInfoVersion())
  //       - the main concern is how to capture the bump reason in grouped changelog

  // pass 2: initialize grouped calculatedChangeTypes together
  for (const group of Object.values(bumpInfo.packageGroups)) {
    // If any of the group's packages have a change, find the max change type out of any package in the group.
    const seenTypes = new Set<ChangeType>();
    for (const packageNameInGroup of group.packageNames) {
      const changeType = calculatedChangeTypes[packageNameInGroup];
      if (changeType) {
        seenTypes.add(changeType);
      }
    }

    if (seenTypes.size) {
      // Set all packages in the group to the max change type.
      const maxChangeInGroup = getMaxChangeType([...seenTypes], group.disallowedChangeTypes);
      for (const packageNameInGroup of group.packageNames) {
        calculatedChangeTypes[packageNameInGroup] = maxChangeInGroup;
      }
    }
  }

  // Pass 3: Calculate change types for dependents and groups.
  // TODO: fix weird behavior - https://github.com/microsoft/beachball/issues/620
  const dependents = bumpDeps ? getDependentsForPackages(bumpInfo) : undefined;
  for (const { change } of changeFileChangeInfos) {
    updateRelatedChangeType({ change, bumpInfo, dependents });
  }

  // pass 3: actually bump the packages in the bumpInfo in memory (no disk writes at this point)
  for (const pkgName of Object.keys(calculatedChangeTypes)) {
    bumpPackageInfoVersion(pkgName, bumpInfo, options);
  }

  // step 4: Bump all the dependency version ranges and collect dependentChangedBy for the changelog
  // (also add any modifiedPackages not previously detected--this should only happen if bumpDeps was false)
  bumpInfo.dependentChangedBy = setDependentVersions(bumpInfo, options);
}
