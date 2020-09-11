import path from 'path';
import { PackageInfo, PackageJson } from '../types/PackageInfo';
import { getActualPackageOptions, getPackageOptions } from '../options/getPackageOptions';

export function infoFromPackageJson(packageJson: PackageJson, packageJsonPath: string): PackageInfo {
  const actualOptions = getActualPackageOptions(path.dirname(packageJsonPath));
  return {
    name: packageJson.name!,
    version: packageJson.version,
    packageJsonPath,
    dependencies: packageJson.dependencies,
    devDependencies: packageJson.devDependencies,
    peerDependencies: packageJson.peerDependencies,
    private: packageJson.private !== undefined ? packageJson.private : false,
    combinedOptions: getPackageOptions(actualOptions),
    packageOptions: getActualPackageOptions(path.dirname(packageJsonPath)),
  };
}
