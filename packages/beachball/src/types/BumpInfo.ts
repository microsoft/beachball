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

  /**  Packages before bumping, which must NOT be mutated. */
  originalPackageInfos: PackageInfos;

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

  /**
   * Map from package name to the git tag(s) that will be created for it during publish.
   * It **only** includes the packages valid for tagging per `getPackagesToPublish`
   * (this includes packages with `shouldPublish: false`).
   *
   * - `undefined` or not set for a package means no tag will be created (`gitTags` disabled
   *   for the package and no `getGitTag` override, or `getGitTag` returned `null`).
   * - When defined, this is a non-empty array of tag strings. The first entry is the "primary"
   *   tag used in changelog metadata; all entries are created as git tags by `tagPackages`.
   *
   * This is computed once at the end of `bumpInMemory` so that changelog generation and
   * `tagPackages` agree on what tag(s) will exist.
   */
  packageTags: { readonly [pkgName: string]: readonly string[] | undefined };
};

/** Dependents cache (child points to parents): if A depends on B, then `{ B: [A] }` */
export type PackageDependents = { readonly [pkgName: string]: ReadonlyArray<string> };
