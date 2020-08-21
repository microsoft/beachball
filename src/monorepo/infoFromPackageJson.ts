import path from 'path';
import { PackageInfo, PackageJson } from '../types/PackageInfo';
import { getPackageOptions } from '../options/getPackageOptions';

export function infoFromPackageJson(packageJson: PackageJson, packageJsonPath: string): PackageInfo {
  return {
    name: packageJson.name!,
    version: packageJson.version,
    packageJsonPath,
    dependencies: packageJson.dependencies,
    devDependencies: packageJson.devDependencies,
    peerDependencies: packageJson.peerDependencies,
    private: packageJson.private !== undefined ? packageJson.private : false,
    options: getPackageOptions(path.dirname(packageJsonPath)),
  };
}
