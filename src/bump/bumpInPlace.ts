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
  const {
    packageInfos,
    scopedPackages,
    calculatedChangeInfos,
    dependentChangeInfos,
    changeFileChangeInfos,
    modifiedPackages,
  } = bumpInfo;

  // pass 1: figure out all the change types for all the packages taking into account the bumpDeps option and version groups
  if (bumpDeps) {
    setDependentsInBumpInfo(bumpInfo);
  }

  setGroupsInBumpInfo(bumpInfo, options);

  for (const [changeFile, changeInfo] of changeFileChangeInfos.entries()) {
    updateRelatedChangeType(changeFile, changeInfo.packageName, bumpInfo, bumpDeps);
  }

  // pass 2: actually bump the packages in the bumpInfo in memory (no disk writes at this point)
  Object.keys(calculatedChangeInfos).forEach(pkgName => {
    bumpPackageInfoVersion(pkgName, bumpInfo, options);
  });

  // pass 3: update the dependentChangeInfos with relevant comments
  for (const changeInfo of Object.values(dependentChangeInfos)) {
    const pkg = changeInfo.packageName;
    dependentChangeInfos[pkg]!.comment = `Bump ${pkg} to v${packageInfos[pkg].version}`;
  }

  // pass 4: Bump all the dependencies packages
  const dependentModifiedPackages = setDependentVersions(packageInfos, scopedPackages);
  dependentModifiedPackages.forEach(pkg => modifiedPackages.add(pkg));

  return bumpInfo;
}
