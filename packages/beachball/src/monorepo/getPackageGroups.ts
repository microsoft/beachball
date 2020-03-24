import { VersionGroupOptions } from '../types/BeachballOptions';
import path from 'path';
import { PackageInfos, PackageGroups } from '../types/PackageInfo';
import { isPathIncluded } from './utils';

export function getPackageGroups(packageInfos: PackageInfos, root: string, groups: VersionGroupOptions[] | undefined) {
  const packageGroups: PackageGroups = {};

  if (groups) {
    // Check every package to see which group it belongs to
    for (const [pkgName, info] of Object.entries(packageInfos)) {
      const packagePath = path.dirname(info.packageJsonPath);
      const relativePath = path.relative(root, packagePath);

      for (const groupOption of groups) {
        if (isPathIncluded(relativePath, groupOption.include, groupOption.exclude)) {
          const groupName = groupOption.name;

          if (packageInfos[pkgName].group) {
            console.error(
              `Error: ${pkgName} cannot belong to multiple groups: [${groupName}, ${packageInfos[pkgName].group}]!`
            );
            process.exit(1);
          }

          packageInfos[pkgName].group = groupName;

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

  return packageGroups;
}
