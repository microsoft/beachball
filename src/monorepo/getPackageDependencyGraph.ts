import { getPackageDependencies } from 'workspace-tools';
import type { PackageInfos } from '../types/PackageInfo';

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

/**
 * Get the graph of non-dev dependencies within the repo.
 * Dev dependencies can be omitted since they don't impact publishing or installation.
 *
 * @returns Each element is a tuple of `[dependency, dependent]` where `dependent` depends on `dependency`.
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

    const allDeps = getPackageDependenciesWrapper(info, packageSet);
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
