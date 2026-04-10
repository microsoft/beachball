import type { ChangeSet, ChangeType } from './ChangeInfo';
import type { PackageInfos, PackageGroups, ScopedPackages } from './PackageInfo';

export type BumpInfo = {
  /**
   * Changes coming from the change files.
   * `readChangeFiles` ensures that this will only contain changes for packages that exist.
   */
  changeFileChangeInfos: Readonly<ChangeSet>;

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
  packageGroups: Readonly<PackageGroups>;

  /**
   * Set of packages that have been modified.
   *
   * For bump/publish, this is primarily populated by `bumpInMemory -> bumpPackageInfoVersion`
   * (which considers dependent bumps, groups, and scopes). Currently it's also updated with any
   * new dependent packages from `bumpInMemory -> setDependentVersions` (if `bumpDeps: false` or
   * certain other circumstances), but there are some [related issues](https://github.com/microsoft/beachball/issues/1123).
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
