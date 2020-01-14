import { unlinkChangeFiles } from '../changefile/unlinkChangeFiles';
import { writeChangelog } from '../changelog/writeChangelog';
import fs from 'fs';
import semver from 'semver';
import { bumpMinSemverRange } from './bumpMinSemverRange';
import { BumpInfo } from '../types/BumpInfo';

export function performBump(bumpInfo: BumpInfo, cwd: string, bumpDeps: boolean) {
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
        const allDeps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
          ...packageJson.peerDependencies,
        };
        for (const dep of Object.keys(allDeps)) {
          if (bumpedPackages.includes(dep)) {
            packageJson.version = semver.inc(packageJson.version, 'patch');
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
