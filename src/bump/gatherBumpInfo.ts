import { initializePackageChangeInfo as initializePackageChangeTypes } from '../changefile/getPackageChangeTypes';
import { readChangeFiles } from '../changefile/readChangeFiles';
import { BumpInfo } from '../types/BumpInfo';
import { bumpInPlace } from './bumpInPlace';
import { BeachballOptions } from '../types/BeachballOptions';
import { getScopedPackages } from '../monorepo/getScopedPackages';
import { PackageInfos } from '../types/PackageInfo';

function gatherPreBumpInfo(options: BeachballOptions, packageInfos: PackageInfos): BumpInfo {
  // Collate the changes per package
  const changes = readChangeFiles(options, packageInfos);

  // const dependentChangeTypes: BumpInfo['dependentChangeTypes'] = {};
  const groupOptions = {};

  return {
    calculatedChangeTypes: initializePackageChangeTypes(changes),
    packageInfos,
    packageGroups: {},
    changeFileChangeInfos: changes,
    modifiedPackages: new Set<string>(),
    newPackages: new Set<string>(),
    scopedPackages: new Set(getScopedPackages(options, packageInfos)),
    dependentChangedBy: {},
    groupOptions,
    dependents: {},
  };
}

export function gatherBumpInfo(options: BeachballOptions, packageInfos: PackageInfos): BumpInfo {
  const bumpInfo = gatherPreBumpInfo(options, packageInfos);

  bumpInPlace(bumpInfo, options);
  return bumpInfo;
}
