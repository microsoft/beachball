import { findPackageRoot } from './paths';
import fs from 'fs';
import path from 'path';
import { listAllTrackedFiles } from './git';

export interface PackageInfo {
  name: string;
  packageJsonPath: string;
  version: string;
  dependencies?: { [dep: string]: string };
  devDependencies?: { [dep: string]: string };
  disallowedChangeTypes: string[];
  private: boolean;
}

interface BeachBallPackageConfig {
  disallowedChangeTypes?: string[];
}

export function getAllPackages(cwd: string): string[] {
  const infos = getPublicPackageInfos(cwd);
  return Object.keys(infos);
}

function infoFromPackageJson(
  packageJson: {
    name: string;
    version: string;
    dependencies?: { [dep: string]: string };
    devDependencies?: { [dep: string]: string };
    beachball?: BeachBallPackageConfig;
    private?: boolean;
  },
  packageJsonPath: string
): PackageInfo {
  return {
    name: packageJson.name!,
    version: packageJson.version,
    packageJsonPath,
    dependencies: packageJson.dependencies,
    devDependencies: packageJson.devDependencies,
    disallowedChangeTypes:
      packageJson.beachball && packageJson.beachball.disallowedChangeTypes ? packageJson.beachball.disallowedChangeTypes : [],
    private: packageJson.private !== undefined ? packageJson.private : false
  };
}

export function getPublicPackageInfos(cwd: string) {
  const trackedFiles = listAllTrackedFiles(cwd);
  const packageJsonFiles = trackedFiles.filter(file => path.basename(file) === 'package.json');
  const packageInfos: { [pkgName: string]: PackageInfo } = {};

  if (packageJsonFiles && packageJsonFiles.length > 0) {
    packageJsonFiles.forEach(packageJsonPath => {
      try {
        const packageJson = JSON.parse(fs.readFileSync(path.join(cwd, packageJsonPath), 'utf-8'));

        let packageInfo: PackageInfo = infoFromPackageJson(packageJson, packageJsonPath);

        if (!packageInfo.private) {
          packageInfos[packageJson.name] = packageInfo;
        }
      } catch (e) {
        // Pass, the package.json is invalid
        console.warn(`Invalid package.json file detected ${packageJsonPath}`);
      }
    });
  } else {
    const packageJsonPath = path.join(findPackageRoot(cwd)!, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    packageInfos[packageJson.name] = infoFromPackageJson(packageJson, packageJsonPath);
  }
  return packageInfos;
}
