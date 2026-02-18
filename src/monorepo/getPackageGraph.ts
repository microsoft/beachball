import pGraph, { type PGraphNodeMap } from 'p-graph';
import type { PackageInfo, PackageInfos } from '../types/PackageInfo';
import { getPackageDependencyGraph } from './getPackageDependencyGraph';

// this export is missing from the top level of the package
type PGraph = ReturnType<typeof pGraph>;

/**
 * Get a PGraph of `affectedPackages` which will run a function in dependency topological order.
 * Note that this version only considers dependencies listed directly in the graph (see comment
 * on `getPackageGraphLayers` for why this might matter).
 * @param affectedPackages Packages to include
 * @param packageInfos All packages in the repo
 * @param runHook Function to run for each package
 * @returns The graph ready to run
 */
export function getPackageGraph(
  affectedPackages: string[],
  packageInfos: PackageInfos,
  runHook: (packageInfo: PackageInfo) => void | Promise<void>
): PGraph {
  const nodeMap: PGraphNodeMap = new Map();
  for (const packageToBump of affectedPackages) {
    nodeMap.set(packageToBump, {
      run: async () => await runHook(packageInfos[packageToBump]),
    });
  }

  const dependencyGraph = getPackageDependencyGraph(affectedPackages, packageInfos).filter(([dep]) => !!dep);
  return pGraph(nodeMap, dependencyGraph as [string, string][]);
}
