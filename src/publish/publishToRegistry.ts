import _ from 'lodash';
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
import { NpmResult } from '../packageManager/npm';

class PublishError extends Error {
  // TODO: this should use Error.cause once node version is updated
  constructor(public packageName: string, public originalError?: unknown) {
    const recoveryMessage = 'Refer to the previous logs for recovery instructions.';
    super(
      originalError
        ? `Error thrown while publishing ${packageName}: ${originalError}\n${recoveryMessage}`
        : `Error publishing ${packageName}! ${recoveryMessage}`
    );
    if (originalError instanceof Error) {
      this.stack = originalError.stack;
    }
  }
}

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
  await callHook({
    hooks: options.hooks,
    hookName: 'prepublish',
    affectedPackages: packagesToPublish,
    packageInfos: bumpInfo.packageInfos,
    concurrency: options.concurrency,
  });

  // finally pass through doing the actual npm publish command
  const succeededPackages = new Set<string>();

  const packagePublishInternal = async (packageInfo: PackageInfo) => {
    let result: NpmResult;
    try {
      result = await packagePublish(packageInfo, options);
    } catch (error) {
      throw new PublishError(packageInfo.name, error);
    }

    if (result.success) {
      succeededPackages.add(packageInfo.name);
    } else {
      throw new PublishError(packageInfo.name);
    }
  };

  try {
    const packageGraph = getPackageGraph(packagesToPublish, bumpInfo.packageInfos, packagePublishInternal);
    await packageGraph.run({
      concurrency: options.concurrency,
      // This option is set to true to ensure that all tasks that are started are awaited,
      // this doesn't actually start tasks for packages of which dependencies have failed.
      continue: true,
    });
  } catch (error) {
    // p-graph will throw an array of errors if it fails to run all tasks
    let err = error;
    if (Array.isArray(error)) {
      if (error.length === 1) {
        // This should basically always be the case
        err = error[0];
      } else {
        // Could get very verbose with all the stacks, but it really shouldn't happen
        const message = error.map(e => (e as Error).stack || String(e)).join('\n\n');
        err = new Error(`Multiple errors occurred while publishing:\n\n${message}`);
        delete (err as Error).stack;
      }
    }

    displayManualRecovery(bumpInfo, succeededPackages);
    throw err;
  }

  // if there is a postpublish hook perform a postpublish pass, calling the routine on each package
  await callHook({
    hooks: options.hooks,
    hookName: 'postpublish',
    affectedPackages: packagesToPublish,
    packageInfos: bumpInfo.packageInfos,
    concurrency: options.concurrency,
  });
}
