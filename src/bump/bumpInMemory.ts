import { getMaxChangeType, initializePackageChangeTypes } from '../changefile/changeTypes';
import type { BumpInfo } from '../types/BumpInfo';
import type { BeachballOptions } from '../types/BeachballOptions';
import { cloneObject } from '../object/cloneObject';
import type { CommandContext } from '../types/CommandContext';
import type { ChangeType } from '../types/ChangeInfo';
import { getDependentsForPackages } from './getDependentsForPackages';
import { updateRelatedChangeType } from './updateRelatedChangeType';
import { bumpPackageInfoVersion } from './bumpPackageInfoVersion';
import { setDependentVersions } from './setDependentVersions';

/**
 * Gather bump info and bump versions in memory.
 * Does NOT mutate the given `context.originalPackageInfos`.
 * @param context Pre-calculated context
 */
export function bumpInMemory(options: BeachballOptions, context: Omit<CommandContext, 'bumpInfo'>): BumpInfo {
  const { bumpDeps } = options;

  // Pass 1: calculatedChangeTypes includes ONLY changes direct from the change files
  // (no dependents, groups, or disallowedChangeTypes)
  const calculatedChangeTypes = initializePackageChangeTypes(context.changeSet);

  // (Splitting out a couple properties that aren't modified as initial step of reducing mutation approach)
  const bumpInfo: Omit<BumpInfo, 'dependentChangedBy' | 'changeFileChangeInfos'> = {
    calculatedChangeTypes,
    packageInfos: cloneObject(context.originalPackageInfos),
    packageGroups: context.packageGroups,
    modifiedPackages: new Set<string>(),
    scopedPackages: context.scopedPackages,
  };

  // Perform the bumps in memory (this previously lived in bumpInPlace.ts)
  // prior history: https://github.com/microsoft/beachball/blob/83e386d87b5fc9269fd734cea127f28b3b23a0a1/src/bump/bumpInPlace.ts

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
  for (const { change } of context.changeSet) {
    updateRelatedChangeType({ change, bumpInfo, dependents });
  }

  // pass 4: actually bump the packages in the bumpInfo in memory (no disk writes at this point)
  for (const pkgName of Object.keys(calculatedChangeTypes)) {
    bumpPackageInfoVersion(pkgName, bumpInfo, options);
  }

  // step 5: Bump all the dependency version ranges and collect dependentChangedBy for the changelog.
  // (also add any modifiedPackages not previously detected--this should only happen if bumpDeps was false)
  const dependentChangedBy = setDependentVersions(bumpInfo, options);

  return {
    ...bumpInfo,
    changeFileChangeInfos: context.changeSet,
    dependentChangedBy,
  };
}
