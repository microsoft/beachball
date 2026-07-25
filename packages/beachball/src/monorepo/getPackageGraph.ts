import { type PGraphNodeMap, PGraph } from 'p-graph';
import { getPackageDependencies } from 'workspace-tools';
import type { PackageInfos, PackageInfo } from '../types/PackageInfo';

/**
 * Get a PGraph of `affectedPackages` for running operations in dependency topological order.
 * The caller provides the actual operation via `packageGraph.run({ run: ... })`, which allows
 * reusing the same graph for multiple operations.
 *
 * When creating the graph, only non-dev dependencies are considered.
 * Dev dependencies can be omitted since they don't impact publishing or installation.
 *
 * Note that this version only considers dependencies of `affectedPackages` (see comment
 * on `getPackageGraphLayers` for why this might matter).
 *
 * @param affectedPackages Packages to include
 * @param packageInfos All packages in the repo
 * @returns The graph ready to run
 */
export function getPackageGraph(affectedPackages: string[] | Set<string>, packageInfos: PackageInfos): PGraph {
  const nodeMap: PGraphNodeMap = new Map();
  for (const pkg of affectedPackages) {
    nodeMap.set(pkg, {});
  }

  const dependencyGraph = _getPackageDependencyGraph(affectedPackages, packageInfos);
  return new PGraph(nodeMap, dependencyGraph);
}

/**
 * Get the graph of non-dev dependencies within the repo, starting from the given `packages`.
 *
 * @returns Each element is a tuple of `[dependency, dependent]` where `dependent` depends on `dependency`.
 * These are the edges of the dependency graph.
 */
export function _getPackageDependencyGraph(
  packages: string[] | Set<string>,
  packageInfos: PackageInfos
): [string, string][] {
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
export function getPackageDependenciesWrapper(packageInfo: PackageInfo, packageSet: Set<string>): string[] {
  return getPackageDependencies(packageInfo, packageSet, {
    withDevDependencies: false,
    withPeerDependencies: true,
    withOptionalDependencies: true,
  });
}
