import { getDisallowedChangeTypes } from '../changefile/getDisallowedChangeTypes';
import { ChangeSet } from '../types/ChangeInfo';
import { PackageGroups, PackageInfos } from '../types/PackageInfo';
import { isValidChangeType } from './isValidChangeType';
import { isValidDependentChangeType } from './isValidDependentChangeType';

export function isValidChangeSet(changeSet: ChangeSet, packageInfos: PackageInfos, packageGroups: PackageGroups) {
  let isValid = true;

  for (const [changeFile, change] of changeSet) {
    const disallowedChangeTypes = getDisallowedChangeTypes(change.packageName, packageInfos, packageGroups);

    if (!change.type || !isValidChangeType(change.type, disallowedChangeTypes)) {
      console.error(`ERROR: invalid change type detected in ${changeFile}: "${change.type}"`);
      isValid = false;
    }

    if (!change.dependentChangeType || !isValidDependentChangeType(change.dependentChangeType, disallowedChangeTypes)) {
      console.error(`ERROR: invalid dependentChangeType detected in ${changeFile}: "${change.dependentChangeType}"`);
      isValid = false;
    }

    // TODO: this should possibly also validate that packages exist and are not private
    // (the logic is currently in gatherBumpInfo, which makes less sense)
  }
  return isValid;
}
