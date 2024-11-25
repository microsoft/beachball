import { getPackageDependencies } from 'workspace-tools/lib/graph/getPackageDependencies';
import type { PackageInfos } from '../types/PackageInfo';

/**
 * @returns Each element is a tuple of [dependency, dependent] where `dependent` depends on `dependency`.
 * These are the edges of the dependency graph.
 */
export function getPackageDependencyGraph(
  packages: string[],
  packageInfos: PackageInfos
): [string | undefined, string][] {
  const packageSet = new Set(packages);
  const dependencyGraph: [string | undefined, string][] = [];

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
    if (allDeps.length > 0) {
      for (const depPkgName of allDeps) {
        dependencyGraph.push([depPkgName, pkgName]);
      }
    } else {
      dependencyGraph.push([undefined, pkgName]);
    }
  }

  return dependencyGraph;
}
