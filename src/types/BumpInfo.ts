import type { ChangeSet, ChangeType } from './ChangeInfo';
import type { DeepReadonly } from './DeepReadonly';
import type { PackageInfos, PackageGroups } from './PackageInfo';

export type BumpInfo = Readonly<{
  /** Changes coming from the change files */
  changeFileChangeInfos: DeepReadonly<ChangeSet>;

  /**
   * Cached version of package info (e.g. package.json, package path).
   * This will be updated to reflect the bumped versions and dependencies.
   */
  packageInfos: PackageInfos;

  /** Change types collated by the package names */
  calculatedChangeTypes: { [pkgName: string]: ChangeType };

  /** Package grouping */
  packageGroups: DeepReadonly<PackageGroups>;

  /** Set of packages that had been modified */
  modifiedPackages: ReadonlySet<string>;

  /** Map from package name to its internal dependency names that were bumped. */
  dependentChangedBy: { readonly [pkgName: string]: ReadonlySet<string> };

  /** Set of packages that are in scope for this bump */
  scopedPackages: ReadonlySet<string>;
}>;

/** Dependents cache (child points to parents): if A depends on B, then `{ B: [A] }` */
export type PackageDependents = { readonly [pkgName: string]: ReadonlyArray<string> };

/**
 * Bump info with additional property set/used only during publishing (not while calculating
 * packages to bump).
 */
export type PublishBumpInfo = BumpInfo & {
  /**
   * Set of packages detected in this info which weren't previously published and didn't have
   * change files. (Only populated if `options.new` is set.)
   */
  newPackages?: ReadonlyArray<string>;
};
