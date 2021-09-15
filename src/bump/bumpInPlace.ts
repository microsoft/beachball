import { BumpInfo } from '../types/BumpInfo';
import { setDependentsInBumpInfo } from './setDependentsInBumpInfo';
import { updateRelatedChangeType } from './updateRelatedChangeType';
import { bumpPackageInfoVersion } from './bumpPackageInfoVersion';
import { BeachballOptions } from '../types/BeachballOptions';
import { setGroupsInBumpInfo } from './setGroupsInBumpInfo';
import { setDependentVersions } from './setDependentVersions';

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

  for (const changeInfo of changeFileChangeInfos.values()) {
    const groupName = Object.keys(bumpInfo.packageGroups).find(group =>
      bumpInfo.packageGroups[group].packageNames.includes(changeInfo.packageName)
    );

    if (groupName) {
      for (const packageNameInGroup of bumpInfo.packageGroups[groupName].packageNames) {
        calculatedChangeTypes[packageNameInGroup] = changeInfo.type;
      }
    }
  }

  for (const changeFile of changeFileChangeInfos.keys()) {
    updateRelatedChangeType(changeFile, bumpInfo, bumpDeps);
  }

  // pass 2: actually bump the packages in the bumpInfo in memory (no disk writes at this point)
  Object.keys(calculatedChangeTypes).forEach(pkgName => {
    bumpPackageInfoVersion(pkgName, bumpInfo, options);
  });

  // pass 4: Bump all the dependencies packages
  bumpInfo.dependentChangedBy = setDependentVersions(packageInfos, scopedPackages);
  Object.keys(bumpInfo.dependentChangedBy).forEach(pkg => modifiedPackages.add(pkg));

  return bumpInfo;
}
