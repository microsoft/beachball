import { BumpInfo } from '../types/BumpInfo';
import { getDependentsForPackages } from './getDependentsForPackages';
import { updateRelatedChangeType } from './updateRelatedChangeType';
import { bumpPackageInfoVersion } from './bumpPackageInfoVersion';
import { BeachballOptions } from '../types/BeachballOptions';
import { setDependentVersions } from './setDependentVersions';

/**
 * Updates BumpInfo according to change types, bump deps, and version groups
 *
 * NOTE: THIS FUNCTION MUTATES STATE!
 */
export function bumpInPlace(bumpInfo: BumpInfo, options: BeachballOptions): void {
  const { bumpDeps } = options;
  const { calculatedChangeTypes, changeFileChangeInfos, modifiedPackages } = bumpInfo;

  // pass 1: figure out all the change types for all the packages taking into account the bumpDeps option and version groups
  const dependents = bumpDeps ? getDependentsForPackages(bumpInfo) : {};

  // TODO: when we do "locked", or "lock step" versioning, we could simply skip setting grouped change types
  //       - set the version for all packages in the group in (bumpPackageInfoVersion())
  //       - the main concern is how to capture the bump reason in grouped changelog

  // pass 2: initialize grouped calculatedChangeTypes together
  for (const { change: changeInfo } of changeFileChangeInfos) {
    const group = Object.values(bumpInfo.packageGroups).find(group =>
      group.packageNames.includes(changeInfo.packageName)
    );

    if (group) {
      for (const packageNameInGroup of group.packageNames) {
        calculatedChangeTypes[packageNameInGroup] = changeInfo.type;
      }
    }
  }

  // Calculate change types for packages and dependencies
  for (const { changeFile } of changeFileChangeInfos) {
    updateRelatedChangeType({ changeFile, bumpInfo, dependents, bumpDeps });
  }

  // pass 3: actually bump the packages in the bumpInfo in memory (no disk writes at this point)
  Object.keys(calculatedChangeTypes).forEach(pkgName => {
    bumpPackageInfoVersion(pkgName, bumpInfo, options);
  });

  // step 4: Bump all the dependencies packages
  bumpInfo.dependentChangedBy = setDependentVersions(bumpInfo, options);
  Object.keys(bumpInfo.dependentChangedBy).forEach(pkg => modifiedPackages.add(pkg));
}
