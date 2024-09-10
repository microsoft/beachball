import { ChangeSet, ChangeType } from './ChangeInfo';
import { DeepReadonly } from './DeepReadonly';
import { PackageInfos, PackageGroups } from './PackageInfo';

export type BumpInfo = {
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
  modifiedPackages: Set<string>;

  /** Set of new packages detected in this info */
  newPackages: Set<string>;

  /** Map from package name to its internal dependency names that were bumped. */
  dependentChangedBy: { [pkgName: string]: Set<string> };

  /** Set of packages that are in scope for this bump */
  scopedPackages: ReadonlySet<string>;
};

/** Dependents cache (child points to parents): if A depends on B, then `{ B: [A] }` */
export type PackageDependents = { [pkgName: string]: string[] };
