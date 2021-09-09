import { VersionGroupOptions } from '../types/BeachballOptions';
import { getPackageGroups } from '../monorepo/getPackageGroups';
import { PackageGroups, PackageInfos } from '../types/PackageInfo';

/**
 * Start by validating group options if provided.
 * If valid or not provided, get a mapping from group name to group info **and update `packageInfos`**.
 * @param packageInfos - Package infos - **WILL BE MODIFIED** to set `packageInfos[pkgName].group`
 * @returns Package groups, or undefined if there's an error
 */
export function getValidatedPackageGroups(
  root: string,
  groups: VersionGroupOptions[] | undefined,
  packageInfos: PackageInfos
): PackageGroups | undefined {
  groups = groups || [];

  if (!Array.isArray(groups)) {
    return undefined;
  }

  const packageGroups = getPackageGroups(packageInfos, root, groups);
  if (!packageGroups) {
    return undefined;
  }

  // make sure no disallowed changetype options exist inside an individual package
  // if repo-wide groups option is defined
  let hasError = false;
  for (const grp of Object.keys(packageGroups)) {
    const pkgs = packageGroups[grp].packageNames;
    for (const pkgName of pkgs) {
      if (packageInfos[pkgName].packageOptions.disallowedChangeTypes) {
        console.error(
          `ERROR: Cannot have a 'disallowedChangeType' inside a package config (${pkgName}) when repo-wide 'groups'`,
          `option is defined; use 'groups.disallowedChangeTypes' instead.`
        );
        hasError = true;
      }
    }
  }

  return hasError ? undefined : packageGroups;
}
