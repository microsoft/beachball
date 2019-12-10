import { getPackageChangeTypes, readChangeFiles, unlinkChangeFiles } from './changefile';
import { getPackageInfos } from './monorepo';
import { writeChangelog } from './changelog';
import fs from 'fs';
import semver from 'semver';
import { ChangeSet, ChangeType } from './ChangeInfo';
import { PackageInfo } from './PackageInfo';

export type BumpInfo = {
  changes: ChangeSet;
  packageInfos: { [pkgName: string]: PackageInfo };
  packageChangeTypes: { [pkgName: string]: ChangeType };
  bumpedDependents?: string[];
};

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

export function performBump(
  bumpInfo: BumpInfo,
  cwd: string,
  bumpDeps: boolean
) {
  const { changes, packageInfos, packageChangeTypes } = bumpInfo;

  // Apply package.json version updates
  Object.keys(packageChangeTypes).forEach(pkgName => {
    const info = packageInfos[pkgName];

    if (!info) {
      console.log(`Unknown package named "${pkgName}" detected from change files, skipping!`);
      return;
    }

    if (packageChangeTypes[pkgName] === 'none') {
      console.log(`"${pkgName}" has a "none" change type, no version bump is required.`);
      return;
    }

    if (info.private) {
      console.log(`Skipping bumping private package "${pkgName}"`);
      return;
    }

    const changeType = packageChangeTypes[pkgName];
    const packageJsonPath = info.packageJsonPath;
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath).toString());

    // Don't bump 'none' type or private packages
    if (changeType !== 'none' && !packageJson.private) {
      packageJson.version = semver.inc(packageJson.version, changeType);
      info.version = packageJson.version;
    }

    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  });

  // If --bump-deps is set, update all dependent package.json's
  if (bumpDeps) {
    const bumpedPackages = Object.keys(packageChangeTypes);
    const bumpedDependents: string[] = [];
    let bumpedFlag = false;

    do {
      bumpedFlag = false;
      Object.keys(packageInfos).forEach(pkgName => {
        if (bumpedPackages.includes(pkgName)) {
          return;
        }

        const info = packageInfos[pkgName];
        const packageJsonPath = info.packageJsonPath;
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath).toString());

        const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies, ...packageJson.peerDependencies };
        for (const dep of Object.keys(allDeps)) {
          if (bumpedPackages.includes(dep)) {
            packageJson.version = semver.inc(packageJson.version, "patch");
            info.version = packageJson.version;
            fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

            bumpedPackages.push(pkgName);
            bumpedDependents.push(pkgName);
            bumpedFlag = true;
            break;
          }
        }
      });
    } while (bumpedFlag);

    bumpInfo.bumpedDependents = bumpedDependents;
  }

  // Apply package dependency bumps, make sure to also write out to private package package.json's
  Object.keys(packageInfos).forEach(pkgName => {
    const info = packageInfos[pkgName];
    const packageJsonPath = info.packageJsonPath;
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath).toString());
    let packageJsonChanged = false;

    ['dependencies', 'devDependencies', 'peerDependencies'].forEach(depKind => {
      if (packageJson[depKind]) {
        Object.keys(packageJson[depKind]).forEach(dep => {
          const packageInfo = packageInfos[dep];

          if (packageInfo) {
            const existingVersionRange = packageJson[depKind][dep];
            const bumpedVersionRange = bumpMinSemverRange(packageInfo.version, existingVersionRange);
            if (existingVersionRange !== bumpedVersionRange) {
              packageJson[depKind][dep] = bumpedVersionRange;
              packageJsonChanged = true;
            }
          }
        });
      }
    });

    if (packageJsonChanged) {
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    }
  });

  // Generate changelog
  writeChangelog(changes, packageInfos);

  // Unlink changelogs
  unlinkChangeFiles(changes, packageInfos, cwd);
}

export function bump(cwd: string, bumpDeps: boolean) {
  return performBump(gatherBumpInfo(cwd), cwd, bumpDeps);
}

function bumpMinSemverRange(minVersion: string, semverRange: string) {
  if (semverRange.startsWith('~') || semverRange.startsWith('^')) {
    // ~1.0.0
    // ^1.0.0
    return semverRange[0] + minVersion;
  } else if (semverRange.includes('>')) {
    // >=1.0.0 <2.0.0
    return `>=${minVersion} <${semver.inc(minVersion, 'major')}`;
  } else if (semverRange.includes(' - ')) {
    // 1.0.0 - 2.0.0
    return `${minVersion} - ${semver.inc(minVersion, 'major')}`;
  }

  return minVersion;
}
