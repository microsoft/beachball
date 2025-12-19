import type { ChangeSet, ChangeType } from './ChangeInfo';
import type { DeepReadonly } from './DeepReadonly';
import type { PackageInfos, PackageGroups, ScopedPackages } from './PackageInfo';

export type BumpInfo = {
  /**
   * Changes coming from the change files.
   * `readChangeFiles` ensures that this will only contain changes for packages that exist.
   */
  changeFileChangeInfos: DeepReadonly<ChangeSet>;

  /**
   * Cached version of package info (e.g. package.json, package path).
   * This will be updated to reflect the bumped versions and dependencies.
   */
  packageInfos: PackageInfos;

  /**
   * Mapping from package name to change type.
   *
   * Initially (after `bumpInMemory`), this just has change types based on the change files.
   * It's updated by the early steps of `bumpInPlace` to consider groups and `disallowedChangeTypes`.
   */
  calculatedChangeTypes: { [pkgName: string]: ChangeType };

  /**
   * Package version groups (not changelog groups) derived from `BeachballOptions.groups`
   * (`VersionGroupOptions`).
   */
  packageGroups: DeepReadonly<PackageGroups>;

  /**
   * Set of packages that had been modified.
   *
   * For the bump command, this is primarily populated by `bumpPackageInfoVersion` (which considers
   * dependent bumps and groups). If `bumpDeps` is false, it might be updated by `setDependentVersions`.
   */
  modifiedPackages: Set<string>;

  /**
   * Map from package name to its internal dependency names that were bumped.
   * This is just used for changelog generation.
   *
   * Note: due to [this issue](https://github.com/microsoft/beachball/issues/1123), there may be
   * packages here that don't have a `calculatedChangeTypes` entry, and those should be ignored
   * when generating changelogs.
   */
  dependentChangedBy: { [pkgName: string]: Set<string> };

  /** Set of packages that are in scope for this bump */
  scopedPackages: ScopedPackages;
};

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
