import { ChangeSet, ChangeType } from './ChangeInfo';
import { PackageInfo, PackageGroups } from './PackageInfo';
import { VersionGroupOptions } from './BeachballOptions';

export type BumpInfo = {
  /** Changes coming from the change files */
  changeFileChangeInfos: ChangeSet;

  /** Cached version of package info (e.g. package.json, package path) */
  packageInfos: { [pkgName: string]: PackageInfo };

  /** Change types collated by the package names */
  calculatedChangeTypes: { [pkgName: string]: ChangeType };

  /** Package grouping */
  packageGroups: PackageGroups;

  /** Package group options */
  groupOptions: { [grp: string]: VersionGroupOptions };

  /** Dependents cache (if A depends on B, then {B: [A]}) - child points to parents */
  dependents: { [pkgName: string]: string[] };

  /** Set of packages that had been modified */
  modifiedPackages: Set<string>;

  /** Set of new packages detected in this info */
  newPackages: Set<string>;

  dependentChangedBy: { [pkgName: string]: Set<string> };

  /** Set of packages that are in scope for this bump */
  scopedPackages: Set<string>;
};
