import { createPackageGraph, PackageDependency, PackageGraph } from 'workspace-tools';
import { PackageInfo, PackageInfos } from '../types/PackageInfo';
import pGraph, { DependencyList, PGraphNodeMap } from 'p-graph';

export function getPackageGraph(
  affectedPackages: Iterable<string>,
  packageInfos: PackageInfos,
  runHook: (packageInfo: PackageInfo) => Promise<void>
) {
  const packageGraph: PackageGraph = createPackageGraphInternal(packageInfos, Array.from(affectedPackages));

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

/**
 * @returns A package graph that only contains the affected packages and their dependencies. This is done by filtering the
 * original package graph, which could contain more packages than the affected packages. This can happen if some scope is
 * provided to the command which filters some package.
 */
function createPackageGraphInternal(packageInfos: PackageInfos, affectedPackages: string[]): PackageGraph {
  const packageGraph: PackageGraph = createPackageGraph(packageInfos, {
    namePatterns: affectedPackages,
    includeDependents: true,
    includeDependencies: true,
    withDevDependencies: true,
    withPeerDependencies: true,
  });

  const filteredGraph: PackageGraph = {
    packages: packageGraph.packages.filter(pkg => affectedPackages.includes(pkg)),
    dependencies: packageGraph.dependencies.filter(dep => affectedPackages.includes(dep.name) && affectedPackages.includes(dep.dependency)),
  };

  if (filteredGraph.packages.length !== affectedPackages.length) {
    throw new Error(`Failed to create the package graph. Affected packages size (${affectedPackages.length}) is different from the created graph size (${filteredGraph.packages.length}). Affected packages: ${affectedPackages.join(', ')}, created graph packages: ${filteredGraph.packages.join(', ')}`);
  }

  return filteredGraph;
}
