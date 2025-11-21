import { bulletedList } from '../logging/bulletedList';
import { singleLineStringify } from '../logging/singleLineStringify';
import type { VersionGroupOptions } from '../types/BeachballOptions';
import type { PackageGroups, PackageInfos } from '../types/PackageInfo';

export function isValidGroupOptions(groups: VersionGroupOptions[]): boolean {
  // Values that violate types could happen in a user-provided object
  if (!Array.isArray(groups)) {
    console.error(
      'ERROR: Expected "groups" configuration setting to be an array. Received:\n' + JSON.stringify(groups)
    );
    return false;
  }

  const badGroups = groups.filter(group => !group.include || !group.name);
  if (badGroups.length) {
    console.error(
      'ERROR: "groups" configuration entries must define "include" and "name". Found invalid groups:\n' +
        bulletedList(badGroups.map(group => singleLineStringify(group)))
    );
    return false;
  }

  return true;
}

/** Validate per-package beachball options are valid for packages in groups */
export function isValidGroupedPackageOptions(packageInfos: PackageInfos, packageGroups: PackageGroups): boolean {
  const errorPackages: string[] = [];

  // make sure no disallowed change type options exist inside an individual package
  for (const [groupName, { packageNames }] of Object.entries(packageGroups)) {
    for (const pkgName of packageNames) {
      if (packageInfos[pkgName].packageOptions.disallowedChangeTypes) {
        errorPackages.push(`${pkgName} in group "${groupName}"`);
      }
    }
  }

  if (errorPackages.length) {
    console.error(
      'ERROR: Found package configs that define disallowedChangeTypes and are also part of a group. ' +
        'Define disallowedChangeTypes in the group instead.\n' +
        bulletedList(errorPackages.sort())
    );
    return false;
  }

  return true;
}
