import { createPackageGraph, PackageDependency } from 'workspace-tools';
import { PackageInfo, PackageInfos } from '../types/PackageInfo';
import pGraph, { DependencyList, PGraphNodeMap } from 'p-graph';

export function getPackageGraph(
  affectedPackages: Iterable<string>,
  packageInfos: PackageInfos,
  runHook: (packageInfo: PackageInfo) => Promise<void>
) {
  const packageGraph = createPackageGraph(packageInfos, {
    namePatterns: Array.from(affectedPackages),
    includeDependents: true,
    includeDependencies: false,
    withDevDependencies: true,
  });

  const nodeMap: PGraphNodeMap = new Map();
  for (const packageToBump of affectedPackages) {
    nodeMap.set(packageToBump, {
      run: async () => await runHook(packageInfos[packageToBump]),
    });
  }

  return pGraph(nodeMap, createDependencyList(packageGraph.dependencies));
}

function createDependencyList(dependencies: PackageDependency[]): DependencyList {
  return dependencies.map(dependency => [dependency.dependency, dependency.name]);
}
