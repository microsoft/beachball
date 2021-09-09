import { PackageGroups } from '../types/PackageInfo';

/**
 * Get the name of the group a package belongs to, if any
 * @returns The name of the matching group, or undefined if not found
 */
export function getGroupForPackage(packageGroups: PackageGroups, packageName: string): string | undefined {
  return Object.keys(packageGroups).find(group => packageGroups[group].packageNames.includes(packageName));
}
