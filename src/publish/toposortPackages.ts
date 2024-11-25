import toposort from 'toposort';
import type { PackageInfos } from '../types/PackageInfo';
import { getPackageDependencyGraph } from '../monorepo/getPackageDependencyGraph';

/**
 * Topologically sort the packages based on their dependency graph.
 * Dependency comes first before dependent.
 * @param packages Packages to be sorted.
 * @param packageInfos PackagesInfos for the sorted packages.
 */
export function toposortPackages(packages: string[], packageInfos: PackageInfos): string[] {
  try {
    return toposort(getPackageDependencyGraph(packages, packageInfos)).filter((pkg): pkg is string => !!pkg);
  } catch (err) {
    throw new Error(`Failed to topologically sort packages: ${(err as Error)?.message}`);
  }
}
