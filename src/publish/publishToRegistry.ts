import _ from 'lodash';
import path from 'path';
import { performBump } from '../bump/performBump';
import { BumpInfo } from '../types/BumpInfo';
import { BeachballOptions } from '../types/BeachballOptions';
import { packagePublish } from '../packageManager/packagePublish';
import { validatePackageVersions } from './validatePackageVersions';
import { displayManualRecovery } from './displayManualRecovery';
import { toposortPackages } from './toposortPackages';
import { shouldPublishPackage } from './shouldPublishPackage';
import { validatePackageDependencies } from './validatePackageDependencies';
import { performPublishOverrides } from './performPublishOverrides';
import { formatList } from '../logging/format';

type Unpromisify<T> = T extends Promise<infer U> ? U : never;

export async function publishToRegistry(originalBumpInfo: BumpInfo, options: BeachballOptions) {
  const bumpInfo = _.cloneDeep(originalBumpInfo);
  const { modifiedPackages, newPackages, packageInfos } = bumpInfo;

  if (options.bump) {
    await performBump(bumpInfo, options);
  }

  let invalid = false;
  if (!(await validatePackageVersions(bumpInfo, options))) {
    displayManualRecovery(bumpInfo);
    invalid = true;
  } else if (!validatePackageDependencies(bumpInfo)) {
    invalid = true;
  }

  if (invalid) {
    console.error('No packages were published due to validation errors (see above for details).');
    process.exit(1);
  }

  // get the packages to publish, reducing the set by packages that don't need publishing
  const sortedPackages = toposortPackages([...modifiedPackages, ...newPackages], packageInfos);
  const packagesToPublish: string[] = [];
  const skippedPackages: string[] = [];

  for (const pkg of sortedPackages) {
    const { publish, reasonToSkip } = shouldPublishPackage(bumpInfo, pkg);
    if (publish) {
      packagesToPublish.push(pkg);
    } else {
      skippedPackages.push(reasonToSkip!); // this includes the package name
    }
  }

  if (skippedPackages.length) {
    console.log(`\nSkipping publishing the following packages:\n${formatList(skippedPackages)}`);
  }

  // performing publishConfig and workspace version overrides requires this procedure to ONLY be run right before npm publish, but NOT in the git push
  performPublishOverrides(packagesToPublish, bumpInfo.packageInfos);

  // if there is a prepublish hook perform a prepublish pass, calling the routine on each package
  const prepublishHook = options.hooks?.prepublish;
  if (prepublishHook) {
    for (const pkg of packagesToPublish) {
      const packageInfo = bumpInfo.packageInfos[pkg];
      await prepublishHook(path.dirname(packageInfo.packageJsonPath), packageInfo.name, packageInfo.version);
    }
  }

  // finally pass through doing the actual npm publish command
  const succeededPackages = new Set<string>();

  for (const pkg of packagesToPublish) {
    const packageInfo = bumpInfo.packageInfos[pkg];
    console.log(`\nPublishing - ${pkg}@${packageInfo.version} with tag ${packageInfo.combinedOptions.tag}.`);

    let result: Unpromisify<ReturnType<typeof packagePublish>>;
    let hasAuthError = false;
    let retries = 0;

    do {
      result = await packagePublish(packageInfo, options);

      if (result.success) {
        console.log('Published!');
        succeededPackages.add(pkg);
      } else {
        retries++;

        hasAuthError = result.all!.includes('ENEEDAUTH');
        const failedMessage = `Publishing "${pkg}" failed${hasAuthError ? ' due to auth error' : ''}:\n\n` + result.all;

        if (hasAuthError) {
          console.error(failedMessage);
        } else if (retries <= options.retries) {
          // has retries left (not a fatal error)
          console.log(failedMessage + `\n\nRetrying... (${retries}/${options.retries})`);
        } else {
          // out of retries
          console.error(failedMessage);
        }
      }
    } while (!result.success && retries <= options.retries && !hasAuthError);

    if (!result.success) {
      displayManualRecovery(bumpInfo, succeededPackages);
      throw new Error('Error publishing! Refer to the previous logs for recovery instructions.');
    }
  }

  // if there is a postpublish hook perform a postpublish pass, calling the routine on each package
  const postpublishHook = options.hooks?.postpublish;
  if (postpublishHook) {
    for (const pkg of packagesToPublish) {
      const packageInfo = bumpInfo.packageInfos[pkg];
      await postpublishHook(path.dirname(packageInfo.packageJsonPath), packageInfo.name, packageInfo.version);
    }
  }
}
