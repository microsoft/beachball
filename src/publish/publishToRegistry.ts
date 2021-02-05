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

export async function publishToRegistry(originalBumpInfo: BumpInfo, options: BeachballOptions) {
  const { registry, token, access, timeout } = options;
  const bumpInfo = _.cloneDeep(originalBumpInfo);
  const { modifiedPackages, newPackages, packageInfos } = bumpInfo;

  if (options.bump) {
    await performBump(bumpInfo, options);
  }

  const succeededPackages = new Set<string>();

  let invalid = false;
  if (!(await validatePackageVersions(bumpInfo, registry))) {
    displayManualRecovery(bumpInfo, succeededPackages);
    invalid = true;
  } else if (!validatePackageDependencies(bumpInfo)) {
    invalid = true;
  }

  if (invalid) {
    console.error('No packages have been published');
    process.exit(1);
  }

  // get the packages to publish, reducing the set by packages that don't need publishing
  const packagesToPublish = toposortPackages([...modifiedPackages, ...newPackages], packageInfos).filter(pkg => {
    const { publish, reasonToSkip } = shouldPublishPackage(bumpInfo, pkg);
    if (!publish) {
      console.log(`Skipping publish - ${reasonToSkip}`);
    }
    return publish;
  });


  // finally pass through doing the actual npm publish command
  for (const pkg of packagesToPublish) {
    const packageInfo = packageInfos[pkg];
    console.log(`Publishing - ${packageInfo.name}@${packageInfo.version} with tag ${packageInfo.combinedOptions.tag}.`);

    // if there is a prepublish hook perform a prepublish
    const prepublishHook = options.hooks?.prepublish;
    if (prepublishHook) {
      const maybeAwait = prepublishHook(
        path.dirname(packageInfo.packageJsonPath),
        packageInfo.name,
        packageInfo.version
      );
      if (maybeAwait instanceof Promise) {
        await maybeAwait;
      }
    }

    let result;
    let retries = 0;

    do {
      result = packagePublish(packageInfo, registry, token, access, timeout);

      if (result.success) {
        console.log('Published!');
        succeededPackages.add(pkg);

        // if there is a postpublish hook perform a postpublish
        const postpublishHook = options.hooks?.postpublish;
        if (postpublishHook) {
          const maybeAwait = postpublishHook(
            path.dirname(packageInfo.packageJsonPath),
            packageInfo.name,
            packageInfo.version
          );
          if (maybeAwait instanceof Promise) {
            await maybeAwait;
          }
        }

        break;
      } else {
        retries++;

        console.log('Publish failed:');
        console.log(result.stderr);

        if (retries <= options.retries) {
          console.log(`\nRetrying... (${retries}/${options.retries})`);
        }
      }
    } while (retries <= options.retries);

    if (!result.success) {
      displayManualRecovery(bumpInfo, succeededPackages);
      console.error(result.stderr);
      throw new Error('Error publishing, refer to the previous error messages for recovery instructions');
    }
  }
}
