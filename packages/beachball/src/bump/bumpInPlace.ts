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
  const { packageInfos, packageChangeTypes, modifiedPackages } = bumpInfo;
  const changes = { ...packageChangeTypes };
  // pass 1: figure out all the change types for all the packages taking into account the bumpDeps option and version groups
  if (bumpDeps) {
    setDependentsInBumpInfo(bumpInfo);
  }

  setGroupsInBumpInfo(bumpInfo, options);

  Object.keys(changes).forEach(pkgName => {
    updateRelatedChangeType(pkgName, changes[pkgName], bumpInfo, bumpDeps);
  });

  // pass 2: actually bump the packages in the bumpInfo in memory (no disk writes at this point)
  Object.keys(packageChangeTypes).forEach(pkgName => {
    bumpPackageInfoVersion(pkgName, bumpInfo);
  });

  // pass 3: Bump all the dependencies packages
  const dependentModifiedPackages = setDependentVersions(packageInfos);
  dependentModifiedPackages.forEach(pkg => modifiedPackages.add(pkg));

  return bumpInfo;
}
