import { PackageInfo, PackageInfos } from '../types/PackageInfo';
import pGraph, { PGraphNodeMap } from 'p-graph';
import { getPackageDependencyGraph } from './getPackageDependencyGraph';

export function getPackageGraph(
  affectedPackages: Iterable<string>,
  packageInfos: PackageInfos,
  runHook: (packageInfo: PackageInfo) => Promise<void>
) {
  const nodeMap: PGraphNodeMap = new Map();
  for (const packageToBump of affectedPackages) {
    nodeMap.set(packageToBump, {
      run: async () => await runHook(packageInfos[packageToBump]),
    });
  }

  const dependencyGraph: [string | undefined, string][] = getPackageDependencyGraph(Array.from(affectedPackages), packageInfos);
  const filteredDependencyGraph = filterDependencyGraph(dependencyGraph);
  return pGraph(nodeMap, filteredDependencyGraph);
}

function filterDependencyGraph(dependencyGraph: [string | undefined, string][]): [string, string][] {
  return dependencyGraph.filter(([dep, _]) => dep !== undefined) as [string, string][];
}