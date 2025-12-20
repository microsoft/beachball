import type { PackageInfo, PackageInfos } from '../types/PackageInfo';
import pGraph, { type PGraphNodeMap } from 'p-graph';
import { getPackageDependencyGraph } from './getPackageDependencyGraph';

// this export is missing from the top level of the package
type PGraph = ReturnType<typeof pGraph>;

export function getPackageGraph(
  affectedPackages: string[],
  packageInfos: PackageInfos,
  runHook: (packageInfo: PackageInfo) => Promise<void>
): PGraph {
  const nodeMap: PGraphNodeMap = new Map();
  for (const packageToBump of affectedPackages) {
    nodeMap.set(packageToBump, {
      run: async () => await runHook(packageInfos[packageToBump]),
    });
  }

  const dependencyGraph: [string | undefined, string][] = getPackageDependencyGraph(affectedPackages, packageInfos);
  const filteredDependencyGraph = filterDependencyGraph(dependencyGraph);
  return pGraph(nodeMap, filteredDependencyGraph);
}

function filterDependencyGraph(dependencyGraph: [string | undefined, string][]): [string, string][] {
  return dependencyGraph.filter(([dep]) => dep !== undefined) as [string, string][];
}
