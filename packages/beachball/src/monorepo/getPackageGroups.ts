import { VersionGroupOptions } from '../types/BeachballOptions';
import path from 'path';
import minimatch from 'minimatch';
import { PackageInfos, PackageGroups } from '../types/PackageInfo';

function isInGroup(relativePath: string, group: VersionGroupOptions) {
  const includePatterns = typeof group.include === 'string' ? [group.include] : group.include;
  let includedFlag = includePatterns.reduce((included, pattern) => included || minimatch(relativePath, pattern), false);

  let excludedFlag = false;

  if (group.exclude) {
    const excludePatterns = typeof group.exclude === 'string' ? [group.exclude] : group.exclude;
    excludedFlag = excludePatterns.reduce(
      (excluded: boolean, pattern: string) => excluded || minimatch(relativePath, pattern),
      false
    );
  }

  return includedFlag && !excludedFlag;
}

export function getPackageGroups(packageInfos: PackageInfos, root: string, groups: VersionGroupOptions[] | undefined) {
  const packageGroups: PackageGroups = {};

  if (groups) {
    // Check every package to see which group it belongs to
    for (const [pkgName, info] of Object.entries(packageInfos)) {
      const packagePath = path.dirname(info.packageJsonPath);
      const relativePath = path.relative(root, packagePath);

      for (const groupOption of groups) {
        if (isInGroup(relativePath, groupOption)) {
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
