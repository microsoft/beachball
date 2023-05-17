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
import { PackageInfo } from '../types/PackageInfo';

export async function publishToRegistry(originalBumpInfo: BumpInfo, options: BeachballOptions) {
  const bumpInfo = _.cloneDeep(originalBumpInfo);
  const { modifiedPackages, newPackages, packageInfos } = bumpInfo;

  if (options.bump) {
    await performBump(bumpInfo, options);
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
    const success = await tryPublishPackage(bumpInfo.packageInfos[pkg], options);
    if (success) {
      succeededPackages.add(pkg);
    } else {
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

async function tryPublishPackage(packageInfo: PackageInfo, options: BeachballOptions) {
  const pkg = packageInfo.name;
  console.log(`\nPublishing - ${pkg}@${packageInfo.version} with tag ${packageInfo.combinedOptions.tag}.`);

  // Unclear whether `options.retries` should be interpreted as "X attempts" or "initial attempt + X retries"...
  // It was previously implemented as the latter, so keep that for now.
  let retries = 0;

  do {
    const result = await packagePublish(packageInfo, options);

    if (result.success) {
      console.log('Published!');
      return true;
    }

    retries++;

    const hasAuthError = result.all!.includes('ENEEDAUTH');
    const failedMessage = `Publishing "${pkg}" failed${hasAuthError ? ' due to auth error' : ''}:\n\n` + result.all;

    if (hasAuthError) {
      console.error(failedMessage);
      // If there's an auth error, future tries are also unlikely to succeed
      return false;
    }

    if (retries <= options.retries) {
      // has retries left (not a fatal error)
      console.log(failedMessage + `\n\nRetrying... (${retries}/${options.retries})`);
    } else {
      // out of retries
      console.error(failedMessage);
    }
  } while (retries <= options.retries);

  return false;
}
