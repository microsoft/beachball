import path from 'path';
import { PackageInfo } from '../types/PackageInfo';
import { getPackageOptions } from "../options/getPackageOptions";
import { PackageOptions } from '../types/BeachballOptions';
export function infoFromPackageJson(packageJson: {
  name: string;
  version: string;
  dependencies?: {
    [dep: string]: string;
  };
  devDependencies?: {
    [dep: string]: string;
  };
  peerDependencies?: {
    [dep: string]: string;
  };
  beachball?: PackageOptions;
  private?: boolean;
}, packageJsonPath: string): PackageInfo {
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
