import { bumpMinSemverRange } from './bumpMinSemverRange';
import { BumpInfo } from '../types/BumpInfo';
import { setDependentsInBumpInfo } from './setDependentsInBumpInfo';
import { updateRelatedChangeType } from './updateRelatedChangeType';
import { bumpPackageInfoVersion } from './bumpPackageInfoVersion';
import { BeachballOptions } from '../types/BeachballOptions';
import { setGroupsInBumpInfo } from './setGroupsInBumpInfo';

/**
 * Updates BumpInfo according to change types, bump deps, and version groups
 *
 * NOTE: THIS FUNCTION MUTATES STATE!
 * @param bumpInfo
 * @param bumpDeps
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
  Object.keys(packageInfos).forEach(pkgName => {
    const info = packageInfos[pkgName];
    ['dependencies', 'devDependencies', 'peerDependencies'].forEach(depKind => {
      if (info[depKind]) {
        Object.keys(info[depKind]).forEach(dep => {
          const packageInfo = packageInfos[dep];
          if (packageInfo) {
            const existingVersionRange = info[depKind][dep];
            const bumpedVersionRange = bumpMinSemverRange(packageInfo.version, existingVersionRange);
            if (existingVersionRange !== bumpedVersionRange) {
              info[depKind][dep] = bumpedVersionRange;
              modifiedPackages.add(pkgName);
            }
          }
        });
      }
    });
  });

  return bumpInfo;
}
