import type { PackageInfo, PackageInfos } from '../types/PackageInfo';
import pGraph, { type PGraphNodeMap } from 'p-graph';
import { getPackageDependencies } from 'workspace-tools';

// this export is missing from the top level of the package
type PGraph = ReturnType<typeof pGraph>;

/**
 * Determine the package dependency graph, and get a `p-graph` instance that can be used to
 * run a task in the correct order for every included package.
 */
export function getPackageGraph(
  affectedPackages: Iterable<string>,
  packageInfos: PackageInfos,
  run: (packageInfo: PackageInfo) => Promise<void>
): PGraph {
  const nodeMap: PGraphNodeMap = new Map();
  for (const packageToBump of affectedPackages) {
    nodeMap.set(packageToBump, {
      run: async () => await run(packageInfos[packageToBump]),
    });
  }

  const packageSet = new Set(affectedPackages);
  const dependencyGraph: [string, string][] = [];

  for (const pkgName of packageSet) {
    const info = packageInfos[pkgName];
    if (!info) {
      throw new Error(`Package info is missing for ${pkgName}.`);
    }

    const allDeps = getPackageDependencies(info, packageSet, {
      withDevDependencies: true,
      withPeerDependencies: true,
      withOptionalDependencies: true,
    });
    if (allDeps.length) {
      for (const depPkgName of allDeps) {
        dependencyGraph.push([depPkgName, pkgName]);
      }
    }
  }

  return pGraph(nodeMap, dependencyGraph);
}
