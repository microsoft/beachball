import type { PackageOptions, RepoOptions } from './BeachballOptions';
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
  /**
   * At a monorepo repo root, this may contain any beachball config.
   * For a single package, only package config is respected.
   */
  beachball?: PackageOptions | Partial<RepoOptions>;
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
  private?: boolean;

  /**
   * @deprecated No longer populated (accessing properties will throw). Get package-specific options
   * (plus any CLI overrides) using `getPackageOption`, or other values via main merged options.
   */
  combinedOptions?: undefined;

  /**
   * Options from this package's `beachball` key in its package.json.
   * If the package specifies an option which was overridden by the CLI, this will reflect the
   * **CLI override** instead of the package's original option (to simplify later merging logic).
   *
   * To get the effective value of an option that could be package-specific, use `getPackageOption`.
   */
  packageOptions?: PackageOptions;
}

export interface PackageInfos {
  [pkgName: string]: PackageInfo;
}

export interface PackageGroupsInfo {
  packageNames: string[];
  /**
   * Disallowed change types for the group. (Package `disallowedChangeTypes` are invalid with groups.)
   *
   * TODO: with current implementation, this also overrides the CLI option...
   */
  disallowedChangeTypes: ChangeType[] | null;
}

/**
 * Package version groups (not changelog groups) derived from `BeachballOptions.groups` (`VersionGroupOptions`).
 */
export type PackageGroups = { [groupName: string]: PackageGroupsInfo };

/** Types of dependencies to consider when bumping. */
export const consideredDependencies = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;

/**
 * In-scope package names. If returned by `getScopedPackages`, this has extra logic to return true
 * without a full lookup when all packages are in scope. (A plain `Set<string>` works for tests.)
 */
export type ScopedPackages = ReadonlySet<string>;
