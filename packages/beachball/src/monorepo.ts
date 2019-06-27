import { searchUp, findPackageRoot } from './paths';
import fs from 'fs';
import path from 'path';
import { listAllTrackedFiles } from './git';
import { fileURLToPath } from 'url';

export interface PackageInfo {
  name: string;
  packageJsonPath: string;
  version: string;
  dependencies: { [dep: string]: string };
  devDependencies: { [dep: string]: string };
}

export function getAllPackages(cwd: string): string[] {
  const infos = getPackageInfos(cwd);
  return Object.keys(infos);
}

export function getPackageInfos(cwd: string) {
  const trackedFiles = listAllTrackedFiles(cwd);
  const packageJsonFiles = trackedFiles.filter(file => path.basename(file) === 'package.json');
  const packageInfos: { [pkgName: string]: PackageInfo } = {};

  if (packageJsonFiles && packageJsonFiles.length > 0) {
    packageJsonFiles.forEach(packageJsonPath => {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

        packageInfos[packageJson.name] = {
          name: packageJson.name,
          version: packageJson.version,
          packageJsonPath,
          dependencies: packageJson.dependencies,
          devDependencies: packageJson.devDependencies
        };
      } catch (e) {
        // Pass, the package.json is invalid
        console.warn(`Invalid package.json file detected ${packageJsonPath}`);
      }
    });
  } else {
    const packageJsonPath = path.join(findPackageRoot(cwd)!, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    packageInfos[packageJson.name] = {
      name: packageJson.name,
      version: packageJson.version,
      packageJsonPath,
      dependencies: packageJson.dependencies,
      devDependencies: packageJson.devDependencies
    };
  }

  return packageInfos;
}
