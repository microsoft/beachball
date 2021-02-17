import { findPackageRoot, findProjectRoot } from '../paths';
import fs from 'fs-extra';
import path from 'path';
import { getWorkspaces } from 'workspace-tools';
import { PackageInfos } from '../types/PackageInfo';
import { infoFromPackageJson } from './infoFromPackageJson';

export function getPackageInfos(cwd: string) {
  const root = findProjectRoot(cwd)!;
  const packageInfos: PackageInfos = {};

  try {
    const workspaceInfo = getWorkspaces(root);

    if (workspaceInfo && workspaceInfo.length > 0) {
      workspaceInfo.forEach(info => {
        const { path: packagePath, packageJson } = info;
        const packageJsonPath = path.join(packagePath, 'package.json');

        try {
          packageInfos[packageJson.name] = infoFromPackageJson(packageJson, packageJsonPath);
        } catch (e) {
          // Pass, the package.json is invalid
          console.warn(`Invalid package.json file detected ${packageJsonPath}: `, e);
        }
      });
    }

    return packageInfos;
  } catch (e) {
    const packageJsonFullPath = path.resolve(findPackageRoot(cwd)!, 'package.json');
    const packageJson = fs.readJSONSync(packageJsonFullPath);
    packageInfos[packageJson.name] = infoFromPackageJson(packageJson, packageJsonFullPath);
    return packageInfos;
  }
}
