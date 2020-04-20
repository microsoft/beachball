import toposort from 'toposort';
import { PackageInfos, PackageDeps } from '../types/PackageInfo';

/**
 * Topological sort the packages based on its dependency graph.
 * Dependency comes first before dependent.
 * @param packages Packages to be sorted.
 * @param packageInfos PackagesInfos for the sorted packages.
 */
export function toposortPackages(packages: string[], packageInfos: PackageInfos): string[] {
  const packageSet = new Set(packages);
  const dependencyGraph: [string | undefined, string][] = [];

  packages.forEach(pkgName => {
    let allDeps: string[] = [];

    ['dependencies', 'devDependencies', 'peerDependencies'].forEach(depKind => {
      const info = packageInfos[pkgName];
      if (!info) {
        throw new Error(`Package info is missing for ${pkgName}.`);
      }

      const deps: PackageDeps | undefined = (info as any)[depKind];
      if (deps) {
        const depPkgNames = Object.keys(deps);
        allDeps = allDeps.concat(depPkgNames);
      }
    });

    allDeps = [...new Set(allDeps)].filter(pkg => packageSet.has(pkg));
    if (allDeps.length > 0) {
      allDeps.forEach(depPkgName => {
        dependencyGraph.push([depPkgName, pkgName]);
      });
    } else {
      dependencyGraph.push([undefined, pkgName]);
    }
  });

  try {
    return toposort(dependencyGraph).filter((pkg): pkg is string => !!pkg);
  } catch (err) {
    throw new Error(`Failed to do toposort for packages: ${err?.message}`);
  }
}
