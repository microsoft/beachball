import { maxChangeType } from '../changefile/getPackageChangeTypes';
import { ChangeType } from '../types/ChangeInfo';
import { BumpInfo } from '../types/BumpInfo';

/**
 * Updates package change types based on dependents (e.g given A -> B, if B has a minor change, A should also have minor change)
 * @param pkgName
 * @param changeType
 * @param bumpInfo
 * @param dependents
 */
export function updateDependentChangeType(
  pkgName: string,
  changeType: ChangeType,
  bumpInfo: BumpInfo,
  dependents: {
    [pkgName: string]: string[];
  }
) {
  const parents = dependents[pkgName];
  const { packageChangeTypes } = bumpInfo;
  packageChangeTypes[pkgName] = maxChangeType(changeType, packageChangeTypes[pkgName]);
  if (parents) {
    parents.forEach(parent => {
      updateDependentChangeType(parent, packageChangeTypes[pkgName], bumpInfo, dependents);
    });
  }
}
