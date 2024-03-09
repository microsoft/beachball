import _ from 'lodash';
import fs from 'fs-extra';
import path from 'path';
import { performBump } from '../bump/performBump';
import { BumpInfo } from '../types/BumpInfo';
import { BeachballOptions } from '../types/BeachballOptions';
import { packagePublish } from '../packageManager/packagePublish';
import { validatePackageVersions } from './validatePackageVersions';
import { displayManualRecovery } from './displayManualRecovery';
import { validatePackageDependencies } from './validatePackageDependencies';
import { performPublishOverrides } from './performPublishOverrides';
import { getPackagesToPublish } from './getPackagesToPublish';
import { callHook } from '../bump/callHook';
import { packPackage } from '../packageManager/packPackage';

/**
 * Publish all the bumped packages to the registry, OR if `packToPath` is specified,
 * pack the packages instead of publishing.
 */
export async function publishToRegistry(originalBumpInfo: BumpInfo, options: BeachballOptions): Promise<void> {
  const verb = options.packToPath ? 'pack' : 'publish';

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
    console.error(`No packages were ${verb}ed due to validation errors (see above for details).`);
    process.exit(1);
  }

  // performing publishConfig and workspace version overrides requires this procedure to ONLY be run right before npm publish, but NOT in the git push
  performPublishOverrides(packagesToPublish, bumpInfo.packageInfos);

  // if there is a prepublish hook perform a prepublish pass, calling the routine on each package
  await callHook(options.hooks?.prepublish, packagesToPublish, bumpInfo.packageInfos);

  // finally pass through doing the actual npm publish command
  const succeededPackages = new Set<string>();
  const packFiles: string[] = [];

  // publish or pack each package
  for (const pkg of packagesToPublish) {
    let success: boolean;
    if (options.packToPath) {
      const result = await packPackage(bumpInfo.packageInfos[pkg], options);
      if (result.success) {
        packFiles.push(result.packFile);
      }
      success = result.success;
    } else {
      success = (await packagePublish(bumpInfo.packageInfos[pkg], options)).success;
    }

    if (success) {
      succeededPackages.add(pkg);
    } else {
      displayManualRecovery(bumpInfo, succeededPackages);
      throw new Error(`Error ${verb}ing! Refer to the previous logs for recovery instructions.`);
    }
  }

  if (options.packToPath && packFiles.length) {
    // Write a file with the proper topological order for publishing the pack files
    const orderJsonPath = path.join(options.packToPath, 'order.json');
    console.log(`Writing package publishing order to ${orderJsonPath}`);
    fs.ensureDirSync(options.packToPath);
    fs.writeJSONSync(orderJsonPath, packFiles, { spaces: 2 });
  }

  // if there is a postpublish hook perform a postpublish pass, calling the routine on each package
  await callHook(options.hooks?.postpublish, packagesToPublish, bumpInfo.packageInfos);
}
