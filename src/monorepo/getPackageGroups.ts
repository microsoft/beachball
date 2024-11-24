import type { VersionGroupOptions } from '../types/BeachballOptions';
import path from 'path';
import type { PackageInfos, PackageGroups } from '../types/PackageInfo';
import { isPathIncluded } from './isPathIncluded';

export function getPackageGroups(
  packageInfos: PackageInfos,
  root: string,
  groups: VersionGroupOptions[] | undefined
): PackageGroups {
  if (!groups?.length) {
    return {};
  }

  const packageGroups: PackageGroups = {};

  const packageNameToGroup: { [packageName: string]: string } = {};

  const errorPackages: Record<string, VersionGroupOptions[]> = {};

  // Check every package to see which group it belongs to
  for (const [pkgName, info] of Object.entries(packageInfos)) {
    const packagePath = path.dirname(info.packageJsonPath);
    const relativePath = path.relative(root, packagePath);

    const groupsForPkg = groups.filter(group =>
      isPathIncluded({ relativePath, include: group.include, exclude: group.exclude })
    );
    if (groupsForPkg.length > 1) {
      // Keep going after this error to ensure we report all errors
      errorPackages[pkgName] = groupsForPkg;
    } else if (groupsForPkg.length === 1) {
      const group = groupsForPkg[0];
      packageNameToGroup[pkgName] = group.name;

      packageGroups[group.name] ??= {
        packageNames: [],
        disallowedChangeTypes: group.disallowedChangeTypes,
      };
      packageGroups[group.name].packageNames.push(pkgName);
    }
  }

  if (errorPackages.length) {
    console.error(
      `ERROR: Found package(s) belonging to multiple groups:\n` +
        Object.entries(errorPackages)
          .map(([pkgName, pkgGroups]) => `- ${pkgName}: [${pkgGroups.map(g => g.name).join(', ')}]`)
          .sort()
          .join('\n')
    );
    // TODO: probably more appropriate to throw here and let the caller handle it?
    process.exit(1);
  }

  return packageGroups;
}
