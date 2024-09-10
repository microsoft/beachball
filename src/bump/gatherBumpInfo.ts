import { initializePackageChangeTypes } from '../changefile/changeTypes';
import { readChangeFiles } from '../changefile/readChangeFiles';
import { BumpInfo } from '../types/BumpInfo';
import { bumpInPlace } from './bumpInPlace';
import { BeachballOptions } from '../types/BeachballOptions';
import { getScopedPackages } from '../monorepo/getScopedPackages';
import { PackageInfos } from '../types/PackageInfo';
import { getPackageGroups } from '../monorepo/getPackageGroups';

/**
 * Gather bump info and bump versions in memory.
 */
export function gatherBumpInfo(options: BeachballOptions, packageInfos: PackageInfos): BumpInfo {
  // Collate the changes per package
  const changes = readChangeFiles(options, packageInfos);

  // Clear non-existent packages from changefiles infos
  const calculatedChangeTypes = initializePackageChangeTypes(changes);
  Object.keys(calculatedChangeTypes).forEach(packageName => {
    if (!packageInfos[packageName]) {
      delete calculatedChangeTypes[packageName];
    }
  });

  const bumpInfo: BumpInfo = {
    calculatedChangeTypes,
    packageInfos,
    packageGroups: getPackageGroups(packageInfos, options.path, options.groups),
    changeFileChangeInfos: changes,
    modifiedPackages: new Set<string>(),
    newPackages: new Set<string>(),
    scopedPackages: new Set(getScopedPackages(options, packageInfos)),
    dependentChangedBy: {},
  };

  bumpInPlace(bumpInfo, options);

  return bumpInfo;
}
