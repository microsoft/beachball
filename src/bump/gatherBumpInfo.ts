import { getPackageChangeTypes } from '../changefile/getPackageChangeTypes';
import { readChangeFiles } from '../changefile/readChangeFiles';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import { ChangeInfo, ChangeSet } from '../types/ChangeInfo';
import { BumpInfo } from '../types/BumpInfo';
import { bumpInPlace } from './bumpInPlace';
import { BeachballOptions } from '../types/BeachballOptions';
import { getScopedPackages } from '../monorepo/getScopedPackages';
import { getChangePath } from '../paths';
import path from 'path';

function gatherPreBumpInfo(options: BeachballOptions): BumpInfo {
  const { path: cwd } = options;
  // Collate the changes per package
  const packageInfos = getPackageInfos(cwd);
  const changes = readChangeFiles(options);
  const changePath = getChangePath(cwd);

  const dependentChangeTypes: BumpInfo['dependentChangeTypes'] = {};
  const groupOptions = {};

  // Clear changes for non-existent and accidental private packages
  // NOTE: likely these are from the same PR that deleted or modified the private flag
  const filteredChanges: ChangeSet = new Map();
  for (let [changeFile, change] of changes) {
    if (!packageInfos[change.packageName] || packageInfos[change.packageName].private) {
      console.warn(
        `Invalid change file detected (non-existent package or private package); delete this file "${path.resolve(
          changePath!,
          changeFile
        )}"`
      );
      continue;
    }

    filteredChanges.set(changeFile, change);
    dependentChangeTypes[change.packageName] = change.dependentChangeType || 'patch';
  }

  // Clear non-existent changeTypes
  const packageChangeTypes = getPackageChangeTypes(filteredChanges);
  Object.keys(packageChangeTypes).forEach(packageName => {
    if (!packageInfos[packageName]) {
      delete packageChangeTypes[packageName];
    }
  });

  return {
    packageChangeTypes,
    packageInfos,
    packageGroups: {},
    changes: filteredChanges,
    modifiedPackages: new Set<string>(),
    newPackages: new Set<string>(),
    scopedPackages: new Set(getScopedPackages(options)),
    dependentChangeTypes,
    groupOptions,
    dependents: {},
    dependentChangeInfos: new Array<ChangeInfo>(),
  };
}

export function gatherBumpInfo(options: BeachballOptions): BumpInfo {
  const bumpInfo = gatherPreBumpInfo(options);
  bumpInPlace(bumpInfo, options);
  return bumpInfo;
}
