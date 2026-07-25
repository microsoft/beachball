import fs from 'fs';
import path from 'path';
import { getCatalogs } from 'workspace-tools';
import { performBump } from '../bump/performBump';
import type { BumpInfo } from '../types/BumpInfo';
import type { BeachballOptions } from '../types/BeachballOptions';
import { packagePublish } from '../packageManager/packagePublish';
import { validatePackageVersions } from './validatePackageVersions';
import { displayManualRecovery } from './displayManualRecovery';
import { validatePackageDependencies } from './validatePackageDependencies';
import { performPublishOverrides } from './performPublishOverrides';
import { getPackagesToPublish } from './getPackagesToPublish';
import { callHook } from '../bump/callHook';
import { getPackageGraph } from '../monorepo/getPackageGraph';
import { packPackage } from '../packageManager/packPackage';
import { BeachballError } from '../types/BeachballError';
import { PGraphError } from 'p-graph';

/** For each layer, a mapping from package name to version */
export type LayerVersionsJson = Record<string, string>[];

/**
 * Publish all the bumped packages to the registry, OR if `packToPath` is specified,
 * pack the packages to that path instead of publishing.
 *
 * This will bump packages on the filesystem first if `options.bump` is true.
 */
export async function publishToRegistry(bumpInfo: BumpInfo, options: BeachballOptions): Promise<void> {
  const { packToPath, verbose } = options;
  const verb = packToPath ? 'pack' : 'publish';

  // bumpInfo already reflects in-memory bumps, but they're only written to disk if bump=true
  // (this uses a separate package graph of all bumped packages, which was probably not intentional,
  // but will stay that way for now)
  if (options.bump) {
    await performBump(bumpInfo, options);
    console.log();
  }

  // Get the packages to publish, reducing the set by packages that don't need publishing.
  // This is where packages with shouldPublish: false are filtered out.
  let packagesToPublish = getPackagesToPublish(bumpInfo, { logSkipped: true });
  if (!packagesToPublish.length) {
    console.log('Nothing to publish\n');
    return;
  }

  let invalid = false;
  // TODO: for bump=false, this should validate the on-disk versions, not in-memory bumped versions
  // (or maybe bumpInMemory logic should calculate changes but skip in-memory bumps when bump=false?)
  // https://github.com/microsoft/beachball/issues/1125
  if (!(await validatePackageVersions(packagesToPublish, bumpInfo.packageInfos, options))) {
    displayManualRecovery(bumpInfo);
    invalid = true;
  } else if (!validatePackageDependencies(packagesToPublish, bumpInfo.packageInfos)) {
    invalid = true;
  }

  if (invalid) {
    // Don't log anything since the validate functions already did it
    throw new BeachballError('Pre-publish validation failed', { alreadyLogged: true });
  }

  // Build the package graph, used for both running hooks and publishing.
  // It's also used to compute graph layers and sort packages to publish if needed.
  const packageGraph = getPackageGraph(packagesToPublish, bumpInfo.packageInfos);

  // Given the packages to publish and the full map of packages in the repo, organize the packages into
  // graph layers that can be published in parallel. The first layer will be packages with no deps
  // on other published packages, and the last layer will be root packages that depend on all others.
  const layers = packageGraph.getLayers();
  // This is the toposorted list of packages to publish
  packagesToPublish = layers.flat();

  // performing publishConfig and workspace version overrides requires this procedure to
  // ONLY be run right before npm publish, but NOT in the git push
  const catalogs = getCatalogs(options.path);
  performPublishOverrides(packagesToPublish, bumpInfo.packageInfos, catalogs);

  // if there is a prepublish hook perform a prepublish pass, calling the routine on each package
  await callHook('prepublish', packageGraph, bumpInfo.packageInfos, options);

  // finally pass through doing the actual npm publish command
  const succeededPackages = new Set<string>();

  try {
    await packageGraph.run({
      concurrency: options.concurrency,
      // This option is set to true to ensure that all tasks that are started are awaited,
      // but it doesn't start tasks for packages of which dependencies have failed.
      continue: true,
      run: async pkgName => {
        const packageInfo = bumpInfo.packageInfos[pkgName];
        let success: boolean;
        if (packToPath) {
          success = await packPackage(packageInfo, { packToPath, verbose, layers });
        } else {
          success = (await packagePublish(packageInfo, options)).success;
        }

        if (success) {
          succeededPackages.add(pkgName);
        } else {
          throw new Error(`Error ${verb}ing! Refer to the previous logs for recovery instructions.`);
        }
      },
    });

    if (packToPath && layers) {
      const layerVersions: LayerVersionsJson = layers.map(layer =>
        Object.fromEntries(layer.map(pkg => [pkg, bumpInfo.packageInfos[pkg].version]))
      );
      const versionsPath = path.join(packToPath, 'versions.json');
      fs.writeFileSync(versionsPath, JSON.stringify(layerVersions, null, 2));
      console.log(`Wrote versions of packed packages to ${versionsPath}`);
    }
  } catch (error) {
    let err = error;
    if (err instanceof PGraphError) {
      // Dedupe the error messages since they'll usually be the same ("Error publishing! ...")
      const errorSet = new Set(err.errors.map(e => (e as Error).message || String(e)));
      err = new Error(Array.from(errorSet).join('\n\n'));
    }

    if (packToPath) {
      // The regular recovery message is mostly irrelevant for packing, since nothing was published
      console.error(
        'Something went wrong with packing packages! No packages were published, so you can address the issue and try again.\n'
      );
    } else {
      displayManualRecovery(bumpInfo, succeededPackages);
    }
    throw err;
  }

  // if there is a postpublish hook perform a postpublish pass, calling the routine on each package
  await callHook('postpublish', packageGraph, bumpInfo.packageInfos, options);
}
