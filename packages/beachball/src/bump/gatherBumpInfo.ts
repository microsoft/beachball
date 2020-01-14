import { getPackageChangeTypes, maxChangeType } from '../changefile/getPackageChangeTypes';
import { readChangeFiles } from '../changefile/readChangeFiles';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import { ChangeSet, ChangeType } from '../types/ChangeInfo';
import { BumpInfo } from '../types/BumpInfo';

import semver from 'semver';
import { PackageInfo, PackageInfos } from '../types/PackageInfo';
import { getAllPackages } from '../monorepo/getAllPackages';
import { bump } from '../commands/bump';
import { bumpMinSemverRange } from './bumpMinSemverRange';

function getCurrentBumpInfo(cwd: string): BumpInfo {
  // Collate the changes per package
  const changes = readChangeFiles(cwd);
  const packageChangeTypes = getPackageChangeTypes(changes);
  const packageInfos = getPackageInfos(cwd);

  // Clear non-existent changes
  const filteredChanges: ChangeSet = new Map();
  for (let [changeFile, change] of changes) {
    if (packageInfos[change.packageName]) {
      filteredChanges.set(changeFile, change);
    }
  }

  // Clear non-existent changeTypes
  Object.keys(packageChangeTypes).forEach(packageName => {
    if (!packageInfos[packageName]) {
      delete packageChangeTypes[packageName];
    }
  });

  return {
    packageChangeTypes,
    packageInfos,
    changes: filteredChanges,
  };
}

function bumpPackageInfoVersion(pkgName: string, changeType: ChangeType, info: PackageInfo) {
  if (!info) {
    console.log(`Unknown package named "${pkgName}" detected from change files, skipping!`);
    return;
  }
  if (changeType === 'none') {
    console.log(`"${pkgName}" has a "none" change type, no version bump is required.`);
    return;
  }
  if (info.private) {
    console.log(`Skipping bumping private package "${pkgName}"`);
    return;
  }
  if (!info.private) {
    info.version = semver.inc(info.version, changeType) as string;
  }
}

function updatePackageChangeType(
  pkgName: string,
  changeType: ChangeType,
  bumpInfo: BumpInfo,
  relations: { [pkgName: string]: string[] }
) {
  const parents = relations[pkgName];
  const { packageChangeTypes } = bumpInfo;
  packageChangeTypes[pkgName] = maxChangeType(changeType, packageChangeTypes[pkgName]);

  if (parents) {
    parents.forEach(parent => {
      updatePackageChangeType(parent, packageChangeTypes[pkgName], bumpInfo, relations);
    });
  }
}

function createRelations(bumpInfo: BumpInfo) {
  const packageInfos = bumpInfo.packageInfos;
  const packages = Object.keys(packageInfos);

  const relations = {};
  packages.forEach(pkgName => {
    const info = packageInfos[pkgName];

    const depTypes = ['dependencies', 'devDependencies', 'peerDependencies'];

    depTypes.forEach(depType => {
      if (info[depType]) {
        for (let [dep, _] of Object.entries(info[depType])) {
          if (packages.includes(dep)) {
            relations[dep] = relations[dep] || [];
            if (!relations[dep].includes(pkgName)) {
              relations[dep].push(pkgName);
            }
          }
        }
      }
    });
  });

  return relations;
}

function getTargetBumpInfo(cwd: string) {
  const bumpInfo = getCurrentBumpInfo(process.cwd());
  const { packageInfos, packageChangeTypes } = bumpInfo;
  const relations = createRelations(bumpInfo);

  const changes = { ...packageChangeTypes };

  Object.keys(changes).forEach(pkgName => {
    updatePackageChangeType(pkgName, changes[pkgName], bumpInfo, relations);
  });

  Object.keys(packageChangeTypes).forEach(pkgName => {
    bumpPackageInfoVersion(pkgName, packageChangeTypes[pkgName], packageInfos[pkgName]);
  });

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
            }
          }
        });
      }
    });
  });

  return bumpInfo;
}

export function gatherBumpInfo(cwd: string): BumpInfo {
  // Collate the changes per package
  const changes = readChangeFiles(cwd);
  const packageChangeTypes = getPackageChangeTypes(changes);
  const packageInfos = getPackageInfos(cwd);
  // Clear non-existent changes
  const filteredChanges: ChangeSet = new Map();
  for (let [changeFile, change] of changes) {
    if (packageInfos[change.packageName]) {
      filteredChanges.set(changeFile, change);
    }
  }
  // Clear non-existent changeTypes
  Object.keys(packageChangeTypes).forEach(packageName => {
    if (!packageInfos[packageName]) {
      delete packageChangeTypes[packageName];
    }
  });
  return {
    packageChangeTypes,
    packageInfos,
    changes: filteredChanges,
  };
}

if (require.main === module) {
  const bumpInfo = getTargetBumpInfo(process.cwd());
  console.log(bumpInfo.packageInfos['a']);
}
