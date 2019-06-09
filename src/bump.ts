import { findPackageRoot, findGitRoot } from './paths';
import { getPackageChanges } from './changefile';
import { getPackagePatterns } from './monorepo';
import fs from 'fs';
import glob from 'glob';
import path from 'path';
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

  // Collate the changes per package
  const packageChangeTypes = getPackageChanges(cwd);

  // Gather all package info from package.json
  const packageInfos = getPackageInfos(cwd);

  // Apply package.json version updates
  Object.keys(packageChangeTypes).forEach(pkgName => {
    const info = packageInfos[pkgName];
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
      packageJsonFiles.forEach(packageJsonPath => {
        try {
          const packageJson = require(path.join(gitRoot, packageJsonPath));

          packageInfos[packageJson.name] = {
            name: packageJson.name,
            version: packageJson.version,
            packageJsonPath,
            dependencies: packageJson.dependencies,
            devDependencies: packageJson.devDependencies
          };
        } catch (e) {
          // Pass, the package.json is invalid
        }
      });
    });
  } else {
    const packageJsonPath = path.join(findPackageRoot(cwd)!, 'package.json');
    const packageJson = require(packageJsonPath);

    packageInfos[packageJson.name] = {
      name: packageJson.name,
      version: packageJson.version,
      packageJsonPath: 'package.json',
      dependencies: packageJson.dependencies,
      devDependencies: packageJson.devDependencies
    };
  }

  return packageInfos;
}
