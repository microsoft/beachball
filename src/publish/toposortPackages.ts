import toposort from 'toposort';
import type { PackageInfos } from '../types/PackageInfo';
import { getPackageDependencyGraph } from '../monorepo/getPackageDependencyGraph';

/**
 * Topologically sort the packages based on their dependency graph.
 * Dependency comes first before dependent.
 * @param packages Packages to be sorted.
 * @param packageInfos Packages in the repo
 */
export function toposortPackages(packages: string[], packageInfos: PackageInfos): string[] {
  const edges = getPackageDependencyGraph(packages, packageInfos);
  try {
    return toposort(edges).filter(Boolean) as string[];
  } catch (err) {
    throw new Error(`Failed to topologically sort packages: ${(err as Error)?.message}`);
  }
}
