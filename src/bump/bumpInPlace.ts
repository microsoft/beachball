import type { BumpInfo } from '../types/BumpInfo';
import { getDependentsForPackages } from './getDependentsForPackages';
import { updateRelatedChangeType } from './updateRelatedChangeType';
import { bumpPackageInfoVersion } from './bumpPackageInfoVersion';
import type { BeachballOptions } from '../types/BeachballOptions';
import { setDependentVersions } from './setDependentVersions';
import { getMaxChangeType } from '../changefile/changeTypes';
import { ChangeType } from '../types/ChangeInfo';
import { initializePackageChangeTypes } from '../changefile/changeTypes';
import type { PackageGroups, PackageInfos } from '../types/PackageInfo';
import { ChangeSet } from '../types/ChangeInfo';
import { _cloneObject } from '../publish/cloneBumpInfo';

/**
 * Gather bump info and bump versions in memory.
 * (This operates on a copy of `packageInfos`.)
 */
export function bumpInPlace(
  params: {
    packageInfos: PackageInfos;
    packageGroups: PackageGroups;
    scopedPackages: string[];
    changeFileChangeInfos: ChangeSet;
  },
  options: BeachballOptions
): BumpInfo {
  const { packageGroups, changeFileChangeInfos } = params;
  const { bumpDeps } = options;

  // Bump versions in a copy of the package infos
  const packageInfos = _cloneObject(params.packageInfos);
  const scopedPackages = new Set(params.scopedPackages);

  // Initialize package change types based on only change files and disallowedChangeTypes
  const calculatedChangeTypes = initializePackageChangeTypes(changeFileChangeInfos, packageInfos);

  const prelimBumpInfo = { packageInfos, calculatedChangeTypes, changeFileChangeInfos, packageGroups, scopedPackages };

  // pass 1: figure out all the change types for all the packages taking into account the bumpDeps option and version groups
  const dependents = bumpDeps ? getDependentsForPackages(prelimBumpInfo) : {};

  // TODO: when we do "locked", or "lock step" versioning, we could simply skip setting grouped change types
  //       - set the version for all packages in the group in (bumpPackageInfoVersion())
  //       - the main concern is how to capture the bump reason in grouped changelog

  // pass 2: initialize grouped calculatedChangeTypes together
  for (const group of Object.values(packageGroups)) {
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

  // Calculate change types for packages and dependencies
  for (const { changeFile } of changeFileChangeInfos) {
    updateRelatedChangeType({
      changeFile,
      bumpInfo: prelimBumpInfo,
      dependents,
      bumpDeps,
    });
  }

  // pass 3: actually bump the packages in the bumpInfo in memory (no disk writes at this point)
  const modifiedPackages = new Set(
    Object.keys(calculatedChangeTypes).filter(pkgName =>
      bumpPackageInfoVersion(pkgName, packageInfos[pkgName], calculatedChangeTypes[pkgName], options)
    )
  );

  // step 4: Bump all the dependencies packages
  const dependentChangedBy = setDependentVersions(prelimBumpInfo, options);
  Object.keys(dependentChangedBy).forEach(pkg => modifiedPackages.add(pkg));

  return {
    ...prelimBumpInfo,
    modifiedPackages,
    dependentChangedBy,
  };
}
