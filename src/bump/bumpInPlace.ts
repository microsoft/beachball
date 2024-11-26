import _ from 'lodash';
import { initializePackageChangeTypes } from '../changefile/changeTypes';
import type { BumpInfo } from '../types/BumpInfo';
import type { BeachballOptions } from '../types/BeachballOptions';
import type { PackageGroups, PackageInfos } from '../types/PackageInfo';
import { bumpPackageInfoVersion } from './bumpPackageInfoVersion';
import { setDependentVersions } from './setDependentVersions';
import { getDependentsForPackages } from './getDependentsForPackages';
import { updateRelatedChangeType } from './updateRelatedChangeType';
import type { ChangeSet } from '../types/ChangeInfo';

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
  const packageInfos = _.cloneDeep(params.packageInfos);
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
  for (const { change: changeInfo } of changeFileChangeInfos) {
    const group = Object.values(packageGroups).find(g => g.packageNames.includes(changeInfo.packageName));

    if (group) {
      for (const packageNameInGroup of group.packageNames) {
        calculatedChangeTypes[packageNameInGroup] = changeInfo.type;
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
