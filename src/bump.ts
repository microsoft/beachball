import { readChangeFiles } from './changefile';
import { ChangeInfo } from './ChangeInfo';
import { findLernaConfig, getPackagePatterns } from './monorepo';
import fs from 'fs';
import path from 'path';
import glob from 'glob';
import { findPackageRoot, findGitRoot } from './paths';
import semver from 'semver';

interface PackageInfo {
  name: string;
  packageJsonPath: string;
  version: string;
  dependencies: { [dep: string]: string };
  devDependencies: { [dep: string]: string };
}

export function bump(cwd?: string) {
  cwd = cwd || process.cwd();

  const gitRoot = findGitRoot(cwd) || cwd;
  const changeTypeWeights = {
    major: 3,
    minor: 2,
    patch: 1,
    none: 0
  };

  // Collate the changes per package
  const changes = readChangeFiles(cwd);
  const changePerPackage: { [pkgName: string]: ChangeInfo['type'] } = {};
  changes.forEach(change => {
    const { packageName } = change;

    if (
      !changePerPackage[packageName] ||
      (change.type !== 'none' && changeTypeWeights[change.type] > changeTypeWeights[changePerPackage[packageName]])
    ) {
      changePerPackage[packageName] = change.type;
    }
  });

  // Gather all package info from package.json
  const packageInfos = getPackageInfos(cwd);

  // Apply package.json version updates
  Object.keys(changePerPackage).forEach(pkgName => {
    const info = packageInfos[pkgName];
    const change = changePerPackage[pkgName];
    const packageJsonPath = path.join(gitRoot, info.packageJsonPath);
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath).toString());

    if (change !== 'none') {
      packageJson.version = semver.inc(packageJson.version, change);
      info.version = packageJson.version;
    }

    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  });

  // Apply package dependency bumps as well as a second pass
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

function getPackageInfos(cwd?: string) {
  cwd = cwd || process.cwd();

  const gitRoot = findGitRoot(cwd) || cwd;
  const packagePatterns = getPackagePatterns(cwd);
  const packageInfos: { [pkgName: string]: PackageInfo } = {};

  if (packagePatterns && packagePatterns.length > 0) {
    packagePatterns.forEach(pattern => {
      const packageJsonPattern = path.join(pattern, 'package.json');
      const packageJsonFiles = glob.sync(packageJsonPattern, { cwd: gitRoot });
      packageJsonFiles.forEach(packageJsonFile => {
        try {
          const packageJson = require(path.join(gitRoot, packageJsonFile));

          packageInfos[packageJson.name] = {
            name: packageJson.name,
            version: packageJson.version,
            packageJsonPath: packageJsonFile,
            dependencies: packageJson.dependencies,
            devDependencies: packageJson.devDependencies
          };
        } catch (e) {
          // Pass, the package.json is invalid
        }
      });
    });
  } else {
    const packageJsonFile = findPackageRoot(cwd)!;
    const packageJson = require(path.join(gitRoot, packageJsonFile));

    packageInfos[packageJson.name] = {
      name: packageJson.name,
      version: packageJson.version,
      packageJsonPath: path.join(cwd!, packageJsonFile),
      dependencies: packageJson.dependencies,
      devDependencies: packageJson.devDependencies
    };
  }

  return packageInfos;
}

function bumpPackage(pkgName: string, changeType: ChangeInfo['type'], cwd?: string) {}
