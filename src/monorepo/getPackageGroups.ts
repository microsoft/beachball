import { VersionGroupOptions } from '../types/BeachballOptions';
import path from 'path';
import { PackageInfos, PackageGroups } from '../types/PackageInfo';
import { isPathIncluded } from './utils';

/**
 * Get a mapping from group name to group info **and update `packageInfos`**.
 * @param packageInfos - Package infos - **WILL BE MODIFIED** to set `packageInfos[pkgName].group`
 * @returns Package groups (this will be an empty object if `groups` is undefined/empty),
 * or undefined if there's an error
 */
export function getPackageGroups(
  packageInfos: PackageInfos,
  root: string,
  groups: VersionGroupOptions[] | undefined
): PackageGroups | undefined {
  const packageGroups: PackageGroups = {};
  let hasError = false;

  const packageNameToGroup: { [packageName: string]: string } = {};

  if (groups && groups.length) {
    // Check every package to see which group it belongs to
    for (const [pkgName, info] of Object.entries(packageInfos)) {
      const packagePath = path.dirname(info.packageJsonPath);
      const relativePath = path.relative(root, packagePath);

      for (const groupOption of groups) {
        if (isPathIncluded(relativePath, groupOption.include, groupOption.exclude)) {
          const groupName = groupOption.name;

          if (packageNameToGroup[pkgName]) {
            console.error(
              `Error: ${pkgName} cannot belong to multiple groups: [${groupName}, ${packageNameToGroup[pkgName]}]!`
            );
            hasError = true;
            continue; // continue validating
          }

          packageNameToGroup[pkgName] = groupName;

          if (!packageGroups[groupName]) {
            packageGroups[groupName] = {
              packageNames: [],
              disallowedChangeTypes: groupOption.disallowedChangeTypes,
            };
          }

          packageGroups[groupName].packageNames.push(pkgName);
        }
      }
    }
  }

  return hasError ? undefined : packageGroups;
}
