import { unlinkChangeFiles } from '../changefile/unlinkChangeFiles';
import { writeChangelog } from '../changelog/writeChangelog';
import fs from 'fs';
import semver from 'semver';
import { bumpMinSemverRange } from './bumpMinSemverRange';
import { BumpInfo } from '../types/BumpInfo';
import { getDependents } from './getDependents';
import { updateDependentChangeType } from './updateDependentChangeType';
import { bumpPackageInfoVersion } from './bumpPackageInfoVersion';

/**
 * Updates BumpInfo according to change types, bump deps, and version groups
 *
 * NOTE: THIS FUNCTION MUTATES STATE!
 * @param bumpInfo
 * @param bumpDeps
 */
function bumpInPlace(bumpInfo: BumpInfo, bumpDeps: boolean) {
  const { packageInfos, packageChangeTypes, modifiedPackages } = bumpInfo;

  const changes = { ...packageChangeTypes };

  // pass 1: figure out all the change types for all the packages taking into account the bumpDeps option and version groups
  if (bumpDeps) {
    const dependents = getDependents(bumpInfo);
    Object.keys(changes).forEach(pkgName => {
      updateDependentChangeType(pkgName, changes[pkgName], bumpInfo, dependents);
    });
  }

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
              modifiedPackages.add(dep);
            }
          }
        });
      }
    });
  });

  return bumpInfo;
}

export function performBump(bumpInfo: BumpInfo, cwd: string, bumpDeps: boolean) {
  bumpInPlace(bumpInfo, bumpDeps);

  const { modifiedPackages, packageInfos, changes } = bumpInfo;

  for (const pkgName of modifiedPackages) {
    const info = packageInfos[pkgName];
    const packageJson = JSON.parse(fs.readFileSync(info.packageJsonPath, 'utf-8'));

    packageJson.version = info.version;

    ['dependencies', 'devDependencies', 'peerDependencies'].forEach(depKind => {
      if (info[depKind]) {
        packageJson[depKind] = { ...packageJson[depKind], ...info[depKind] };
      }
    });

    fs.writeFileSync(info.packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  }

  // Generate changelog
  writeChangelog(changes, packageInfos);
  // Unlink changelogs
  unlinkChangeFiles(changes, packageInfos, cwd);
}
