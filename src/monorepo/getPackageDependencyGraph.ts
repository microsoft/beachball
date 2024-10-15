import { PackageInfos } from '../types/PackageInfo';

/**
 * @returns Each element is a tuple of [dependency, dependent] where `dependent` depends on `dependency`.
 * These are the edges of the dependency graph.
 */
export function getPackageDependencyGraph(packages: string[], packageInfos: PackageInfos): [string | undefined, string][] {
  const packageSet = new Set(packages);
  const dependencyGraph: [string | undefined, string][] = [];

  for (const pkgName of packageSet) {
    const info = packageInfos[pkgName];
    if (!info) {
      throw new Error(`Package info is missing for ${pkgName}.`);
    }

    const allDeps = new Set(
      [info.dependencies, info.devDependencies, info.peerDependencies, info.optionalDependencies]
        .flatMap(deps => Object.keys(deps || {}))
        .filter(pkg => packageSet.has(pkg))
    );
    if (allDeps.size) {
      for (const depPkgName of allDeps) {
        dependencyGraph.push([depPkgName, pkgName]);
      }
    } else {
      dependencyGraph.push([undefined, pkgName]);
    }
  }

  return dependencyGraph;
}
