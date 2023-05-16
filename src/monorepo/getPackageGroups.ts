import { VersionGroupOptions } from '../types/BeachballOptions';
import path from 'path';
import { PackageInfos, PackageGroups } from '../types/PackageInfo';
import { isPathIncluded } from './isPathIncluded';

export function getPackageGroups(packageInfos: PackageInfos, root: string, groups: VersionGroupOptions[] | undefined) {
  if (!groups?.length) {
    return {};
  }

  const packageGroups: PackageGroups = {};

  const packageNameToGroup: { [packageName: string]: string } = {};

  let hasError = false;

  // Check every package to see which group it belongs to
  for (const [pkgName, info] of Object.entries(packageInfos)) {
    const packagePath = path.dirname(info.packageJsonPath);
    const relativePath = path.relative(root, packagePath);

    const groupsForPkg = groups.filter(group => isPathIncluded(relativePath, group.include, group.exclude));
    if (groupsForPkg.length > 1) {
      // Keep going after this error to ensure we report all errors
      console.error(
        `ERROR: "${pkgName}" cannot belong to multiple groups: [${groupsForPkg.map(g => g.name).join(', ')}]`
      );
      hasError = true;
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

  if (hasError) {
    // TODO: probably more appropriate to throw here and let the caller handle it?
    process.exit(1);
  }

  return packageGroups;
}
