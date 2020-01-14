import { ChangeSet, ChangeType } from './ChangeInfo';
import { PackageInfo } from './PackageInfo';

export type BumpInfo = {
  changes: ChangeSet;
  packageInfos: { [pkgName: string]: PackageInfo };
  packageChangeTypes: { [pkgName: string]: ChangeType };
  modifiedPackages: Set<string>;
};
