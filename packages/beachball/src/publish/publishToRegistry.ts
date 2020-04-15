import { performBump } from '../bump/performBump';
import { BumpInfo } from '../types/BumpInfo';
import { BeachballOptions } from '../types/BeachballOptions';
import { packagePublish } from '../packageManager/packagePublish';
import { validatePackageVersions } from './validatePackageVersions';
import { displayManualRecovery } from './displayManualRecovery';
import _ from 'lodash';

export async function publishToRegistry(originalBumpInfo: BumpInfo, options: BeachballOptions) {
  const { registry, tag, token, access, timeout } = options;
  const bumpInfo = _.cloneDeep(originalBumpInfo);
  const { modifiedPackages, newPackages } = bumpInfo;

  // Execute prepublish hook if available
  if (options.hooks?.prepublish) {
    const maybePromise = options.hooks.prepublish(bumpInfo);

    if (maybePromise instanceof Promise) {
      await maybePromise;
    }
  }

  await performBump(bumpInfo, options);

  const succeededPackages = new Set<string>();

  if (!validatePackageVersions(bumpInfo, registry)) {
    displayManualRecovery(bumpInfo, succeededPackages);
    console.error('No packages have been published');
    process.exit(1);
  }

  [...modifiedPackages, ...newPackages].forEach(pkg => {
    if (!bumpInfo.scopedPackages.has(pkg)) {
      console.log(`Skipping publish for out-of-scope package ${pkg}`);
      return;
    }

    const packageInfo = bumpInfo.packageInfos[pkg];
    const changeType = bumpInfo.packageChangeTypes[pkg];
    if (changeType === 'none') {
      return;
    }
    if (!packageInfo.private) {
      console.log(`Publishing - ${packageInfo.name}@${packageInfo.version}`);

      let result;
      let retries = 0;

      do {
        result = packagePublish(packageInfo, registry, token, tag, access, timeout);

        if (result.success) {
          console.log('Published!');
          succeededPackages.add(pkg);
          return;
        } else {
          retries++;

          if (retries <= options.retries) {
            console.log(`Published failed, retrying... (${retries}/${options.retries})`);
          }
        }
      } while (retries <= options.retries);

      displayManualRecovery(bumpInfo, succeededPackages);
      console.error(result.stderr);
      throw new Error('Error publishing, refer to the previous error messages for recovery instructions');
    } else {
      console.warn(
        `Skipping publish of ${packageInfo.name} since it is marked private. Version has been bumped to ${packageInfo.version}`
      );
    }
  });

  return;
}
