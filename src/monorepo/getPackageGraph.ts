import { type PGraphNodeMap, PGraph } from 'p-graph';
import { getPackageDependencies } from 'workspace-tools';
import type { PackageInfo, PackageInfos } from '../types/PackageInfo';

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

  const dependencyGraph = _getPackageDependencyGraph(affectedPackages, packageInfos);
  return new PGraph(nodeMap, dependencyGraph);
}

/**
 * Get the graph of non-dev dependencies within the repo.
 * Dev dependencies can be omitted since they don't impact publishing or installation.
 *
 * @returns Each element is a tuple of `[dependency, dependent]` where `dependent` depends on `dependency`.
 * These are the edges of the dependency graph.
 */
export function _getPackageDependencyGraph(packages: string[], packageInfos: PackageInfos): [string, string][] {
  const packageSet = new Set(packages);
  const dependencyGraph: [string, string][] = [];

  for (const pkgName of packageSet) {
    const info = packageInfos[pkgName];
    if (!info) {
      throw new Error(`Package info is missing for ${pkgName}.`);
    }

    const allDeps = getPackageDependenciesWrapper(info, packageSet);
    if (allDeps.length) {
      for (const depPkgName of allDeps) {
        dependencyGraph.push([depPkgName, pkgName]);
      }
    }
  }

  return dependencyGraph;
}

/**
 * Call {@link getPackageDependencies} with consistent options: ignore dev deps,
 * include deps of all other types if included in `packageSet`.
 */
export function getPackageDependenciesWrapper(packageInfo: PackageInfos[string], packageSet: Set<string>): string[] {
  return getPackageDependencies(packageInfo, packageSet, {
    withDevDependencies: false,
    withPeerDependencies: true,
    withOptionalDependencies: true,
  });
}
