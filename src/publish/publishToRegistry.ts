import { performBump } from '../bump/performBump';
import type { PublishBumpInfo } from '../types/BumpInfo';
import type { BeachballOptions } from '../types/BeachballOptions';
import { packagePublish } from '../packageManager/packagePublish';
import { validatePackageVersions } from './validatePackageVersions';
import { displayManualRecovery } from './displayManualRecovery';
import { validatePackageDependencies } from './validatePackageDependencies';
import { performPublishOverrides } from './performPublishOverrides';
import { getPackagesToPublish } from './getPackagesToPublish';
import { callHook } from '../bump/callHook';
import { getPackageGraph } from '../monorepo/getPackageGraph';
import type { PackageInfo } from '../types/PackageInfo';
import { packPackage } from '../packageManager/packPackage';
import { getCatalogs } from 'workspace-tools';
import { toposortPackages } from './toposortPackages';
import { getPancakes } from './getPancakes';

/**
 * Publish all the bumped packages to the registry, OR if `packToPath` is specified,
 * pack the packages to that path instead of publishing.
 *
 * This will bump packages on the filesystem first if `options.bump` is true.
 */
export async function publishToRegistry(bumpInfo: PublishBumpInfo, options: BeachballOptions): Promise<void> {
  const { packToPath, verbose } = options;
  const verb = packToPath ? 'pack' : 'publish';

  // bumpInfo already reflects in-memory bumps, but they're only written to disk if bump=true
  if (options.bump) {
    await performBump(bumpInfo, options);
  }

  // get the packages to publish, reducing the set by packages that don't need publishing
  let packagesToPublish = getPackagesToPublish(bumpInfo, { logSkipped: true });
  if (!packagesToPublish.length) {
    console.log('Nothing to publish');
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
    // TODO: consider throwing instead
    // eslint-disable-next-line no-restricted-properties
    process.exit(1);
  }

  let pancakes: string[][] | undefined;
  if (packToPath && options.packStyle === 'pancake') {
    // If packing in pancake style, get that ordering instead of toposorting
    pancakes = getPancakes({ packagesToPublish, bumpInfo, options });
  } else if (options.concurrency === 1) {
    // Otherwise, unless publishing concurrently, toposort the packages in case publishing fails
    // partway through. (Concurrent pubishing uses p-graph which also handles ordering.)
    packagesToPublish = toposortPackages(packagesToPublish, bumpInfo.packageInfos);
  }

  // performing publishConfig and workspace version overrides requires this procedure to
  // ONLY be run right before npm publish, but NOT in the git push
  const catalogs = getCatalogs(options.path);
  performPublishOverrides(packagesToPublish, bumpInfo.packageInfos, catalogs);

  // if there is a prepublish hook perform a prepublish pass, calling the routine on each package
  await callHook(options.hooks?.prepublish, packagesToPublish, bumpInfo.packageInfos, options.concurrency);

  // finally pass through doing the actual npm publish command
  const succeededPackages = new Set<string>();
  let packIndex = 0;

  const packagePublishInternal = async (packageInfo: PackageInfo) => {
    let success: boolean;
    if (packToPath) {
      success = await packPackage(packageInfo, {
        packToPath,
        verbose,
        packInfo: pancakes ? { pancakes } : { index: packIndex++, total: packagesToPublish.length },
      });
    } else {
      success = (await packagePublish(packageInfo, options)).success;
    }

    if (success) {
      succeededPackages.add(packageInfo.name);
    } else {
      throw new Error(`Error ${verb}ing! Refer to the previous logs for recovery instructions.`);
    }
  };

  try {
    if (options.concurrency === 1) {
      for (const pkg of packagesToPublish) {
        await packagePublishInternal(bumpInfo.packageInfos[pkg]);
      }
    } else {
      const packageGraph = getPackageGraph(packagesToPublish, bumpInfo.packageInfos, packagePublishInternal);
      await packageGraph.run({
        concurrency: options.concurrency,
        // This option is set to true to ensure that all tasks that are started are awaited,
        // this doesn't actually start tasks for packages of which dependencies have failed.
        continue: true,
      });
    }
  } catch (error) {
    // p-graph will throw an array of errors if it fails to run all tasks
    let err = error;
    if (Array.isArray(error)) {
      // Dedupe the error messages since they'll usually be the same ("Error publishing! ...")
      const errorSet = new Set(error.map(e => (e as Error).message || String(e)));
      err = new Error(Array.from(errorSet).join('\n\n'));
    }

    if (packToPath) {
      // The regular recovery message is mostly irrelevant for packing, since nothing was published
      console.error(
        'Something went wrong with packing packages! No packages were published, so you can address the issue and try again.'
      );
    } else {
      displayManualRecovery(bumpInfo, succeededPackages);
    }
    throw err;
  }

  // if there is a postpublish hook perform a postpublish pass, calling the routine on each package
  await callHook(options.hooks?.postpublish, packagesToPublish, bumpInfo.packageInfos, options.concurrency);
}
