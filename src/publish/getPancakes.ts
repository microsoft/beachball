import { getPackageDependencies } from 'workspace-tools';
import type { PackageInfos } from '../types/PackageInfo';

/**
 * Given the packages to publish and the full map of packages in the repo, organize the packages into
 * "pancakes": packages from different layers of the graph that can be published in parallel.
 * The first pancake will be the leaf packages with no dependencies, and the last pancake will be
 * the root packages that depend on all others.
 *
 * Layers are computed over the full dependency graph (from `packageInfos`), then filtered to
 * `packagesToPublish`. This means a package's layer accounts for transitive dependencies through
 * packages that aren't being published, to be safe.
 *
 * Currently, there's only VERY basic cycle handling: all cycles are grouped together on a final
 * layer, regardless of any interdependencies. The `toposort` package already used by beachball
 * doesn't handle cycles at all, so this should be fine for now. (Tarjan's strongly connected
 * components algorithm could be used to break cycles into more layers if needed in the future.)
 *
 * @returns An array of layers, where each layer is an array of package names that can be
 * published in parallel.
 */
export function getPancakes(params: { packagesToPublish: string[]; packageInfos: PackageInfos }): string[][] {
  const { packagesToPublish, packageInfos } = params;
  if (packagesToPublish.length === 0) {
    return [];
  }

  const allPackages = Object.keys(packageInfos);
  const allPackageSet = new Set(allPackages);
  const publishSet = new Set(packagesToPublish);

  // Build dependency graph for all packages in the repo (ignoring devDependencies, since they're
  // not installed by consumers and can't cause ordering issues)
  const dependentsOf = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const pkgName of allPackages) {
    const deps = getPackageDependencies(packageInfos[pkgName], allPackageSet, {
      withDevDependencies: false,
      withPeerDependencies: true,
      withOptionalDependencies: true,
    });
    inDegree.set(pkgName, deps.length);

    for (const dep of deps) {
      let list = dependentsOf.get(dep);
      if (!list) {
        list = [];
        dependentsOf.set(dep, list);
      }
      list.push(pkgName);
    }
  }

  // Kahn's algorithm: extract layers in BFS order
  const placed = new Set<string>();
  const pancakes: string[][] = [];

  // Seed with all packages that have no in-repo dependencies
  let currentLayer = allPackages.filter(pkg => (inDegree.get(pkg) ?? 0) === 0);

  while (currentLayer.length > 0) {
    // Filter this layer to only packages being published
    const publishLayer = currentLayer.filter(pkg => publishSet.has(pkg));
    if (publishLayer.length > 0) {
      pancakes.push(publishLayer);
    }

    // Mark placed and compute next layer
    const nextLayer: string[] = [];
    for (const pkg of currentLayer) {
      placed.add(pkg);
      for (const dependent of dependentsOf.get(pkg) ?? []) {
        const newDegree = (inDegree.get(dependent) ?? 1) - 1;
        inDegree.set(dependent, newDegree);
        if (newDegree === 0) {
          nextLayer.push(dependent);
        }
      }
    }
    currentLayer = nextLayer;
  }

  // Handle cycles: any remaining packages not yet placed
  const cyclic = packagesToPublish.filter(pkg => !placed.has(pkg));
  if (cyclic.length > 0) {
    pancakes.push(cyclic);
  }

  return pancakes;
}
