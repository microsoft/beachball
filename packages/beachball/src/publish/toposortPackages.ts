import { PackageInfos } from '../types/PackageInfo';
import toposort from 'toposort';
import * as _ from 'lodash';

/**
 * Topological sort the packages based on its dependency graph.
 * Dependency comes first before dependent.
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

      const deps = packageInfos[pkgName][depKind];
      if (deps) {
        const depPkgNames = Object.keys(deps);
        allDeps = allDeps.concat(depPkgNames);
      }
    });

    allDeps = _.uniq(allDeps).filter(pkg => packageSet.has(pkg));
    if (allDeps.length > 0) {
      allDeps.forEach(depPkgName => {
        dependencyGraph.push([depPkgName, pkgName]);
      });
    } else {
      dependencyGraph.push([undefined, pkgName]);
    }
  });

  try {
    const sortedPackages = toposort(dependencyGraph).filter(pkg => !!pkg);
    return sortedPackages;
  } catch (err) {
    throw new Error('Failed to do toposort for packages: ' + err.message);
  }
}
