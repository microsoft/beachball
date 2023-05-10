import toposort from 'toposort';
import { PackageInfos } from '../types/PackageInfo';

/**
 * Topologically sort the packages based on their dependency graph.
 * Dependency comes first before dependent.
 * @param packages Packages to be sorted.
 * @param packageInfos PackagesInfos for the sorted packages.
 */
export function toposortPackages(packages: string[], packageInfos: PackageInfos): string[] {
  const packageSet = new Set(packages);
  const dependencyGraph: [string | undefined, string][] = [];

  for (const pkgName of packageSet) {
    const info = packageInfos[pkgName];
    if (!info) {
      throw new Error(`Package info is missing for ${pkgName}.`);
    }

    const allDeps = new Set(
      [info.dependencies, info.devDependencies, info.peerDependencies]
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

  try {
    return toposort(dependencyGraph).filter((pkg): pkg is string => !!pkg);
  } catch (err) {
    throw new Error(`Failed to topologically sort packages: ${err?.message}`);
  }
}
