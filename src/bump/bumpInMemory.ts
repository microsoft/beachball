import { initializePackageChangeTypes } from '../changefile/changeTypes';
import { readChangeFiles } from '../changefile/readChangeFiles';
import type { BumpInfo } from '../types/BumpInfo';
import { bumpInPlace } from './bumpInPlace';
import type { BeachballOptions } from '../types/BeachballOptions';
import { getScopedPackages } from '../monorepo/getScopedPackages';
import type { PackageInfos } from '../types/PackageInfo';
import { getPackageGroups } from '../monorepo/getPackageGroups';
import { cloneObject } from '../object/cloneObject';

/**
 * Gather bump info and bump versions in memory.
 * Does NOT mutate the given `originalPackageInfos`.
 */
export function bumpInMemory(options: BeachballOptions, originalPackageInfos: PackageInfos): BumpInfo {
  const packageInfos = cloneObject(originalPackageInfos);
  const changes = readChangeFiles(options, packageInfos);

  // Determine base change types for each package (not considering disallowedChangeTypes or groups)
  const calculatedChangeTypes = initializePackageChangeTypes(changes);

  const bumpInfo: BumpInfo = {
    calculatedChangeTypes,
    packageInfos,
    packageGroups: getPackageGroups(packageInfos, options.path, options.groups),
    changeFileChangeInfos: changes,
    modifiedPackages: new Set<string>(),
    scopedPackages: new Set(getScopedPackages(options, packageInfos)),
    dependentChangedBy: {},
  };

  bumpInPlace(bumpInfo, options);

  return bumpInfo;
}
