import { getPackageDependenciesWrapper } from '../monorepo/getPackageGraph';
import { bulletedList } from '../logging/bulletedList';
import type { PackageInfos } from '../types/PackageInfo';

/**
 * Given the packages to publish and the full map of packages in the repo, organize the packages into
 * graph layers that can be published in parallel. The first layer will be packages with no deps
 * on other published packages, and the last layer will be root packages that depend on all others.
 *
 * Currently, there's only VERY basic cycle handling: all cycles are grouped together on a final
 * layer, regardless of any interdependencies. The `toposort` package previously used by beachball
 * doesn't handle cycles at all, so this should be fine for now. (Tarjan's strongly connected
 * components algorithm could be used to break cycles into more layers if needed in the future.)
 *
 * (Note: layers are computed based on **only** the set of published packages. This *should* be safe
 * from an ordering standpoint, at least with beachball's default behaviors. When layer support was
 * initially added, this function would consider all graph edges if `bumpDeps: false`, `scope` set,
 * or any change had `dependentChangeType: "none", type: "(not none)"`. But logic that predated
 * layers didn't consider this, so it's probably fine in practice, especially since the layer logic
 * is mainly to guard against relatively rare mid-publish failures or race conditions.)
 *
 * @returns An array of layers, where each layer is an array of package names that can be
 * published in parallel.
 */
export function getPackageGraphLayers(packagesToPublish: string[], packageInfos: PackageInfos): string[][] {
  if (!packagesToPublish.length) {
    return [];
  }

  const publishSet = new Set(packagesToPublish);

  // Build internal dependency graph
  const dependentsOf = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const pkgName of packagesToPublish) {
    // Get dependencies of this package, filtered to publishSet.
    // Ignore dev deps since they're not installed by consumers and can't cause ordering issues.
    const deps = getPackageDependenciesWrapper(packageInfos[pkgName], publishSet);
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
  const layers: string[][] = [];

  // Seed with all packages that have no in-repo dependencies
  let currentLayer = packagesToPublish.filter(pkg => (inDegree.get(pkg) ?? 0) === 0);

  while (currentLayer.length) {
    layers.push(currentLayer);

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
  if (cyclic.length) {
    console.warn(
      [
        'Circular dependencies detected among the following packages:',
        bulletedList(cyclic),
        'If these packages have any interdependencies, publishing order MAY BE INCORRECT.',
        '',
      ].join('\n')
    );
    layers.push(cyclic);
  }

  return layers;
}
