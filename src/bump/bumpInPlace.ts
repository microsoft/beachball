import { BumpInfo } from '../types/BumpInfo';
import { setDependentsInBumpInfo } from './setDependentsInBumpInfo';
import { updateRelatedChangeType } from './updateRelatedChangeType';
import { bumpPackageInfoVersion } from './bumpPackageInfoVersion';
import { BeachballOptions } from '../types/BeachballOptions';
import { setGroupsInBumpInfo } from './setGroupsInBumpInfo';
import { setDependentVersions } from './setDependentVersions';
import { getMaxChangeType, MinChangeType } from '../changefile/getPackageChangeTypes';

/**
 * Updates BumpInfo according to change types, bump deps, and version groups
 *
 * NOTE: THIS FUNCTION MUTATES STATE!
 */
export function bumpInPlace(bumpInfo: BumpInfo, options: BeachballOptions) {
  const { bumpDeps } = options;
  const { packageInfos, scopedPackages, calculatedChangeTypes, changeFileChangeInfos, modifiedPackages } = bumpInfo;

  // pass 1: figure out all the change types for all the packages taking into account the bumpDeps option and version groups
  if (bumpDeps) {
    setDependentsInBumpInfo(bumpInfo);
  }

  setGroupsInBumpInfo(bumpInfo, options);

  // TODO: when we do "locked", or "lock step" versioning, we could simply skip setting grouped change types
  //       - set the version for all packages in the group in (bumpPackageInfoVersion())
  //       - the main concern is how to capture the bump reason in grouped changelog

  // pass 2: initialize grouped calculatedChangeTypes together
  for (const { change: changeInfo } of changeFileChangeInfos) {
    const groupName = Object.keys(bumpInfo.packageGroups).find(group =>
      bumpInfo.packageGroups[group].packageNames.includes(changeInfo.packageName)
    );

    if (groupName) {
      const maxChangeTypeInGroup = bumpInfo.packageGroups[groupName].packageNames
        .map(packageNameInGroup => calculatedChangeTypes[packageNameInGroup])
        .reduce((prev, next) => getMaxChangeType(prev, next, null), MinChangeType);
      for (const packageNameInGroup of bumpInfo.packageGroups[groupName].packageNames) {
        calculatedChangeTypes[packageNameInGroup] = maxChangeTypeInGroup;
      }
    }
  }

  for (const { changeFile } of changeFileChangeInfos) {
    updateRelatedChangeType(changeFile, bumpInfo, bumpDeps);
  }

  // pass 3: actually bump the packages in the bumpInfo in memory (no disk writes at this point)
  Object.keys(calculatedChangeTypes).forEach(pkgName => {
    bumpPackageInfoVersion(pkgName, bumpInfo, options);
  });

  // step 4: Bump all the dependencies packages
  bumpInfo.dependentChangedBy = setDependentVersions(packageInfos, scopedPackages, options);
  Object.keys(bumpInfo.dependentChangedBy).forEach(pkg => modifiedPackages.add(pkg));

  return bumpInfo;
}
