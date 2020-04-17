import { BumpInfo } from '../types/BumpInfo';
import { listPackageVersions } from '../packageManager/listPackageVersions';
import { shouldPublishPackage } from './shouldPublishPackage';

/**
 * Validate a package being published is not already published.
 */
export function validatePackageVersions(bumpInfo: BumpInfo, registry: string): boolean {
  let hasErrors: boolean = false;
  bumpInfo.modifiedPackages.forEach(pkg => {
    const { publish, reasonToSkip } = shouldPublishPackage(bumpInfo, pkg);
    if (!publish) {
      console.log(`Skipping package version validation - ${reasonToSkip}`);
      return;
    }

    const packageInfo = bumpInfo.packageInfos[pkg];
    process.stdout.write(`Validating package version - ${packageInfo.name}@${packageInfo.version}`);
    const publishedVersions = listPackageVersions(packageInfo.name, registry);
    if (publishedVersions.includes(packageInfo.version)) {
      console.error(
        `\nERROR: Attempting to bump to a version that already exists in the registry: ${packageInfo.name}@${packageInfo.version}`
      );
      hasErrors = true;
    } else {
      process.stdout.write(' OK!\n');
    }
  });

  return !hasErrors;
}
