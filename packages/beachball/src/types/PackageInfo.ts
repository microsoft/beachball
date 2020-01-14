import { PackageOptions } from './BeachballOptions';

export interface PackageInfo {
  name: string;
  packageJsonPath: string;
  version: string;
  dependencies?: { [dep: string]: string };
  devDependencies?: { [dep: string]: string };
  peerDependencies?: { [dep: string]: string };
  private: boolean;
  options: PackageOptions;
}

export interface PackageInfos {
  [pkgName: string]: PackageInfo;
}
