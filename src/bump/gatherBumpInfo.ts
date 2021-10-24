import { initializePackageChangeInfo as initializePackageChangeTypes } from '../changefile/getPackageChangeTypes';
import { readChangeFiles } from '../changefile/readChangeFiles';
import { BumpInfo } from '../types/BumpInfo';
import { bumpInPlace } from './bumpInPlace';
import { BeachballOptions } from '../types/BeachballOptions';
import { getScopedPackages } from '../monorepo/getScopedPackages';
import { getChangePath } from '../paths';
import path from 'path';
import { PackageInfos } from '../types/PackageInfo';

function gatherPreBumpInfo(options: BeachballOptions, packageInfos: PackageInfos): BumpInfo {
  const { path: cwd } = options;
  // Collate the changes per package
  const changes = readChangeFiles(options, packageInfos);
  const changePath = getChangePath(cwd);

  // const dependentChangeTypes: BumpInfo['dependentChangeTypes'] = {};
  const groupOptions = {};

  // Clear changes for non-existent and accidental private packages
  // NOTE: likely these are from the same PR that deleted or modified the private flag
  const filteredChanges = changes.filter(({ changeFile, change }) => {
    const errorType = !packageInfos[change.packageName]
      ? 'nonexistent'
      : packageInfos[change.packageName].private
      ? 'private'
      : undefined;
    if (errorType) {
      const resolution = options.groupChanges ? 'remove the entry from this file' : 'delete this file';
      console.warn(
        `Change detected for ${errorType} package ${change.packageName}; ${resolution}: "${path.resolve(
          changePath!,
          changeFile
        )}"`
      );
      return false;
    }
    return true;
  });

  // Clear non-existent packages from changefiles infos
  const calculatedChangeTypes = initializePackageChangeTypes(filteredChanges);
  Object.keys(calculatedChangeTypes).forEach(packageName => {
    if (!packageInfos[packageName]) {
      delete calculatedChangeTypes[packageName];
    }
  });

  return {
    calculatedChangeTypes,
    packageInfos,
    packageGroups: {},
    changeFileChangeInfos: filteredChanges,
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
