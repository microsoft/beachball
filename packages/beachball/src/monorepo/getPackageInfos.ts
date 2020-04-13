import { findPackageRoot, findGitRoot } from '../paths';
import fs from 'fs';
import path from 'path';
import { listAllTrackedFiles } from '../git';
import { PackageInfos } from '../types/PackageInfo';
import { infoFromPackageJson } from './infoFromPackageJson';
export function getPackageInfos(cwd: string) {
  const gitRoot = findGitRoot(cwd)!;
  const packageJsonFiles = listAllTrackedFiles(['**/package.json', 'package.json'], gitRoot);
  const packageInfos: PackageInfos = {};
  if (packageJsonFiles && packageJsonFiles.length > 0) {
    packageJsonFiles.forEach(packageJsonPath => {
      try {
        const packageJsonFullPath = path.join(gitRoot, packageJsonPath);
        const packageJson = JSON.parse(fs.readFileSync(packageJsonFullPath, 'utf-8'));
        packageInfos[packageJson.name] = infoFromPackageJson(packageJson, packageJsonFullPath);
      } catch (e) {
        // Pass, the package.json is invalid
        console.warn(`Invalid package.json file detected ${packageJsonPath}: `, e);
      }
    });
  } else {
    const packageJsonFullPath = path.join(gitRoot, findPackageRoot(cwd)!, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonFullPath, 'utf-8'));
    packageInfos[packageJson.name] = infoFromPackageJson(packageJson, packageJsonFullPath);
  }
  return packageInfos;
}
