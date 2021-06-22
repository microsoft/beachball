import { ChangeInfo, ChangeSet, ChangeType } from './ChangeInfo';
import { PackageInfo, PackageGroups } from './PackageInfo';
import { VersionGroupOptions } from './BeachballOptions';

export type BumpInfo = {
  /** Changes coming from the change files */
  changeFileChangeInfos: ChangeSet;

  /** Cached version of package info (e.g. package.json, package path) */
  packageInfos: { [pkgName: string]: PackageInfo };

  /** Change info collated by the package names */
  calculatedChangeInfos: { [pkgName: string]: ChangeInfo };

  /** Package grouping */
  packageGroups: PackageGroups;

  /** Package group options */
  groupOptions: { [grp: string]: VersionGroupOptions };

  /** Dependents cache (if A depends on B, then {B: [A]}) - child points to parents */
  dependents: { [pkgName: string]: string[] };

  /** Dependent change types (if A depends on B & B has a change, B would specify what its dependents would be change to - i.e. A would be changed to this type) */
  dependentChangeTypes: { [pkgName: string]: ChangeType };

  /** A Cache of the ChangeInfo for all the dependents in this bump session */
  dependentChangeInfos: { [pkgName: string]: ChangeInfo };

  /** Set of packages that had been modified */
  modifiedPackages: Set<string>;

  /** Set of new packages detected in this info */
  newPackages: Set<string>;

  /** Set of packages that are in scope for this bump */
  scopedPackages: Set<string>;
};
