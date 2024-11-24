import type { PackageOptions, BeachballOptions } from './BeachballOptions';
import type { ChangeType } from './ChangeInfo';

export interface PackageDeps {
  [dep: string]: string;
}

/**
 * The `publishConfig` field in package.json.
 * (If modifying this, be sure to update `acceptedKeys` in src/publish/performPublishOverrides.ts.)
 */
export type PublishConfig = Pick<
  PackageJson,
  'types' | 'typings' | 'main' | 'module' | 'exports' | 'repository' | 'bin' | 'browser' | 'files'
>;

export interface PackageJson {
  name: string;
  version: string;
  main?: string;
  module?: string;
  types?: string;
  typings?: string;
  exports?: unknown;
  repository?: unknown;
  bin?: unknown;
  browser?: unknown;
  files?: string[];
  dependencies?: PackageDeps;
  devDependencies?: PackageDeps;
  peerDependencies?: PackageDeps;
  optionalDependencies?: PackageDeps;
  private?: boolean;
  scripts?: Record<string, string>;
  beachball?: BeachballOptions;
  /** Overrides applied during publishing */
  publishConfig?: PublishConfig;
}

export interface PackageInfo {
  name: string;
  packageJsonPath: string;
  version: string;
  dependencies?: PackageDeps;
  devDependencies?: PackageDeps;
  peerDependencies?: PackageDeps;
  optionalDependencies?: PackageDeps;
  private: boolean;

  /** merged default, repo, package, and CLI options */
  combinedOptions: PackageOptions;

  /** options that are SPECIFIC to the package from the `beachball` key in its package.json (might be nothing) */
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

/** Types of dependencies to consider when bumping. */
export const consideredDependencies = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;
