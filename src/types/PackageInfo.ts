import { PackageOptions, BeachballOptions } from './BeachballOptions';
import { ChangeType } from './ChangeInfo';

export interface PackageDeps {
  [dep: string]: string;
}

export interface PackageJson {
  name: string;
  version: string;
  main?: string;
  module?: string;
  types?: string;
  typings?: string;
  exports?: any;
  repository?: any;
  bin?: any;
  browser?: any;
  files?: string[];
  dependencies?: PackageDeps;
  devDependencies?: PackageDeps;
  peerDependencies?: PackageDeps;
  private?: boolean;
  beachball?: BeachballOptions;
  /** Overrides applied during publishing */
  publishConfig?: Pick<
    PackageJson,
    'types' | 'typings' | 'main' | 'module' | 'exports' | 'repository' | 'bin' | 'browser' | 'files'
  >;
}

export interface PackageInfo {
  name: string;
  packageJsonPath: string;
  version: string;
  dependencies?: PackageDeps;
  devDependencies?: PackageDeps;
  peerDependencies?: PackageDeps;
  private: boolean;

  /** options that are combined from the root configuration */
  combinedOptions: PackageOptions;

  /** options that are SPECIFIC to the package from its configuration file (might be nothing) */
  packageOptions: Partial<PackageOptions>;
}

export interface PackageInfos {
  [pkgName: string]: PackageInfo;
}

export interface PackageGroupsInfo {
  packageNames: string[];
  disallowedChangeTypes: ChangeType[] | null;
}

export type PackageGroups = { [groupName: string]: PackageGroupsInfo };
