import { PackageOptions, BeachballOptions } from './BeachballOptions';
import { ChangeType } from './ChangeInfo';

export interface PackageDeps {
  [dep: string]: string;
}

export interface PackageJson {
  name: string;
  version: string;
  main?: string;
  dependencies?: PackageDeps;
  devDependencies?: PackageDeps;
  peerDependencies?: PackageDeps;
  private?: boolean;
  beachball?: BeachballOptions;
}

export interface PackageInfo {
  name: string;
  packageJsonPath: string;
  version: string;
  dependencies?: PackageDeps;
  devDependencies?: PackageDeps;
  peerDependencies?: PackageDeps;
  private: boolean;
  options: PackageOptions;
  group?: string;
}

export interface PackageInfos {
  [pkgName: string]: PackageInfo;
}

export interface PackageGroupsInfo {
  packageNames: string[];
  disallowedChangeTypes: ChangeType[] | null;
}

export type PackageGroups = { [groupName: string]: PackageGroupsInfo };
