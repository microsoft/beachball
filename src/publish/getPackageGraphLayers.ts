import type { BeachballOptions } from '../types/BeachballOptions';
import type { PublishBumpInfo } from '../types/BumpInfo';
import { getPackageDependenciesWrapper } from '../monorepo/getPackageDependencyGraph';
import { bulletedList } from '../logging/bulletedList';

/**
 * Given the packages to publish and the full map of packages in the repo, organize the packages into
 * graph layers that can be published in parallel. The first layer will be packages with no deps
 * on other published packages, and the last layer will be root packages that depend on all others.
 *
 * If possible, layers are computed based on only the set of published packages. This should be safe
 * with beachball's default behaviors, but layers will be computed over the full graph under any of
 * the following conditions which might cause missing edges. (Not 100% sure this is necessary, but
 * not sure how to disprove it either...)
 * - `bumpDeps` is false
 * - `scope` is set
 * - There are `newPackages`
 * - Any change has `dependentChangeType` set to "none"
 *
 * Currently, there's only VERY basic cycle handling: all cycles are grouped together on a final
 * layer, regardless of any interdependencies. The `toposort` package previously used by beachball
 * doesn't handle cycles at all, so this should be fine for now. (Tarjan's strongly connected
 * components algorithm could be used to break cycles into more layers if needed in the future.)
 *
 * @returns An array of layers, where each layer is an array of package names that can be
 * published in parallel.
 */
export function getPackageGraphLayers(params: {
  packagesToPublish: string[];
  bumpInfo: Pick<PublishBumpInfo, 'changeFileChangeInfos' | 'packageInfos' | 'newPackages'>;
  options: Pick<BeachballOptions, 'bumpDeps' | 'scope'>;
}): string[][] {
  const { packagesToPublish, bumpInfo, options } = params;
  const { packageInfos, changeFileChangeInfos } = bumpInfo;
  if (packagesToPublish.length === 0) {
    return [];
  }

  // See function comment for explanation
  const canConsiderPublishedOnly =
    options.bumpDeps &&
    !options.scope &&
    !bumpInfo.newPackages?.length &&
    !changeFileChangeInfos.some(change => change.change.dependentChangeType === 'none');
  const packagesToConsider = canConsiderPublishedOnly ? packagesToPublish : Object.keys(packageInfos);
  const packagesToConsiderSet = new Set(packagesToConsider);

  // Build internal dependency graph for packagesToConsider
  const dependentsOf = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const pkgName of packagesToConsider) {
    // Get dependencies of this package, filtered to packagesToConsiderSet.
    // Ignore dev deps since they're not installed by consumers and can't cause ordering issues.
    const deps = getPackageDependenciesWrapper(packageInfos[pkgName], packagesToConsiderSet);
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
  let currentLayer = packagesToConsider.filter(pkg => (inDegree.get(pkg) ?? 0) === 0);

  while (currentLayer.length > 0) {
    // Filter this layer to only packages being published
    const publishLayer = canConsiderPublishedOnly
      ? currentLayer
      : currentLayer.filter(pkg => packagesToPublish.includes(pkg));
    if (publishLayer.length > 0) {
      layers.push(publishLayer);
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
