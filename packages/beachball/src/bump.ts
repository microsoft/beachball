import { findGitRoot } from './paths';
import { getPackageChangeTypes } from './changefile';
import { getPackageInfos, PackageInfo } from './monorepo';
import { writeChangelog } from './changelog';
import fs from 'fs';
import path from 'path';
import semver from 'semver';

export type PackageInfo = PackageInfo;

export type BumpInfo = ReturnType<typeof bump>;

export function bump(cwd: string) {
  const gitRoot = findGitRoot(cwd) || cwd;

  // Collate the changes per package
  const packageChangeTypes = getPackageChangeTypes(cwd);

  // Gather all package info from package.json
  const packageInfos = getPackageInfos(cwd);

  // Apply package.json version updates
  Object.keys(packageChangeTypes).forEach(pkgName => {
    const info = packageInfos[pkgName];

    if (!info) {
      console.log(`Unknown package named "${pkgName}" detected from change files, skipping!`);
      return;
    }

    const changeType = packageChangeTypes[pkgName];
    const packageJsonPath = path.join(gitRoot, info.packageJsonPath);
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath).toString());

    if (changeType !== 'none') {
      packageJson.version = semver.inc(packageJson.version, changeType);
      info.version = packageJson.version;
    }

    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  });

  // Apply package dependency bumps
  Object.keys(packageInfos).forEach(pkgName => {
    const info = packageInfos[pkgName];
    const packageJsonPath = path.join(gitRoot, info.packageJsonPath);
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath).toString());

    ['dependencies', 'devDependencies'].forEach(depKind => {
      if (packageJson[depKind]) {
        Object.keys(packageJson[depKind]).forEach(dep => {
          const packageInfo = packageInfos[dep];

          if (packageInfo) {
            const existingVersionRange = packageJson[depKind][dep];
            packageJson[depKind][dep] = bumpMinSemverRange(packageInfo.version, existingVersionRange);
          }
        });
      }
    });

    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  });

  // Generate changelog
  writeChangelog(packageInfos, cwd);

  return {
    packageChangeTypes,
    packageInfos
  };
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
