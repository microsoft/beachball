import { findPackageRoot, findProjectRoot } from '../paths';
import fs from 'fs-extra';
import path from 'path';
import { listAllTrackedFiles } from 'workspace-tools';
import { PackageInfos } from '../types/PackageInfo';
import { infoFromPackageJson } from './infoFromPackageJson';

export function getPackageInfos(cwd: string) {
  const root = findProjectRoot(cwd)!;
  const packageJsonFiles = listAllTrackedFiles(['**/package.json', 'package.json'], root);
  const packageInfos: PackageInfos = {};

  if (packageJsonFiles && packageJsonFiles.length > 0) {
    packageJsonFiles.forEach(packageJsonPath => {
      try {
        const packageJsonFullPath = path.join(root, packageJsonPath);
        const packageJson = fs.readJSONSync(packageJsonFullPath);
        packageInfos[packageJson.name] = infoFromPackageJson(packageJson, packageJsonFullPath);
      } catch (e) {
        // Pass, the package.json is invalid
        console.warn(`Invalid package.json file detected ${packageJsonPath}: `, e);
      }
    });
  } else {
    const packageJsonFullPath = path.join(root, findPackageRoot(cwd)!, 'package.json');
    const packageJson = fs.readJSONSync(packageJsonFullPath);
    packageInfos[packageJson.name] = infoFromPackageJson(packageJson, packageJsonFullPath);
  }
  return packageInfos;
}
