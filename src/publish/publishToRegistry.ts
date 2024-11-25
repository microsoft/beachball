import _ from 'lodash';
import { performBump } from '../bump/performBump';
import { PublishBumpInfo } from '../types/BumpInfo';
import { BeachballOptions } from '../types/BeachballOptions';
import { packagePublish } from '../packageManager/packagePublish';
import { validatePackageVersions } from './validatePackageVersions';
import { displayManualRecovery } from './displayManualRecovery';
import { validatePackageDependencies } from './validatePackageDependencies';
import { performPublishOverrides } from './performPublishOverrides';
import { getPackagesToPublish } from './getPackagesToPublish';
import { callHook } from '../bump/callHook';
import { getPackageGraph } from '../monorepo/getPackageGraph';
import { PackageInfo } from '../types/PackageInfo';

/**
 * Publish all the bumped packages to the registry.
 * This will bump packages on the filesystem first if `options.bump` is true.
 */
export async function publishToRegistry(originalBumpInfo: PublishBumpInfo, options: BeachballOptions): Promise<void> {
  const bumpInfo = _.cloneDeep(originalBumpInfo);

  if (options.bump) {
    await performBump(bumpInfo, options);
  }

  // get the packages to publish, reducing the set by packages that don't need publishing
  const packagesToPublish = getPackagesToPublish(bumpInfo);

  let invalid = false;
  if (!(await validatePackageVersions(packagesToPublish, bumpInfo.packageInfos, options))) {
    displayManualRecovery(bumpInfo);
    invalid = true;
  } else if (!validatePackageDependencies(packagesToPublish, bumpInfo.packageInfos)) {
    invalid = true;
  }

  if (invalid) {
    console.error('No packages were published due to validation errors (see above for details).');
    process.exit(1);
  }

  // performing publishConfig and workspace version overrides requires this procedure to
  // ONLY be run right before npm publish, but NOT in the git push
  performPublishOverrides(packagesToPublish, bumpInfo.packageInfos);

  // if there is a prepublish hook perform a prepublish pass, calling the routine on each package
  await callHook(options.hooks?.prepublish, packagesToPublish, bumpInfo.packageInfos, options.concurrency);

  // finally pass through doing the actual npm publish command
  const succeededPackages = new Set<string>();

  const packagePublishInternal = async (packageInfo: PackageInfo) => {
    const result = await packagePublish(packageInfo, options);
    if (result.success) {
      succeededPackages.add(packageInfo.name);
    } else {
      throw new Error('Error publishing! Refer to the previous logs for recovery instructions.');
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
      const errorSet = new Set(error);
      err = new Error(Array.from(errorSet).join('\n'));
    }
    displayManualRecovery(bumpInfo, succeededPackages);
    throw err;
  }

  // if there is a postpublish hook perform a postpublish pass, calling the routine on each package
  await callHook(options.hooks?.postpublish, packagesToPublish, bumpInfo.packageInfos, options.concurrency);
}
