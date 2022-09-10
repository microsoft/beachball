import { BeachballOptions } from '../types/BeachballOptions';
import { getPackageGroups } from '../monorepo/getPackageGroups';
import { getPackageInfos } from '../monorepo/getPackageInfos';

export function isValidGroupOptions(options: BeachballOptions) {
  const { path: root, groups } = options;
  if (!Array.isArray(groups)) {
    return false;
  }

  for (const group of groups) {
    if (!group.include || !group.name) {
      return false;
    }
  }

  const packageInfos = getPackageInfos(options);
  const packageGroups = getPackageGroups(packageInfos, root, groups);
  // make sure no disallowed changetype options exist inside an individual package

  for (const grp of Object.keys(packageGroups)) {
    const pkgs = packageGroups[grp].packageNames;
    for (const pkgName of pkgs) {
      if (packageInfos[pkgName].packageOptions.disallowedChangeTypes) {
        console.error(
          `Cannot have a disallowedChangeType inside a package config (${pkgName}) when there is a group defined; use the groups.disallowedChangeTypes instead.`
        );

        return false;
      }
    }
  }

  return true;
}
