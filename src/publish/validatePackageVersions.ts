import { BumpInfo } from '../types/BumpInfo';
import { listPackageVersions } from '../packageManager/listPackageVersions';
import { shouldPublishPackage } from './shouldPublishPackage';
import { NpmOptions } from '../types/NpmOptions';

/**
 * Validate a package being published is not already published.
 */
export async function validatePackageVersions(bumpInfo: BumpInfo, options: NpmOptions): Promise<boolean> {
  let hasErrors: boolean = false;

  const packages = [...bumpInfo.modifiedPackages].filter(pkg => {
    const { publish, reasonToSkip } = shouldPublishPackage(bumpInfo, pkg);
    if (!publish) {
      console.log(`Skipping package version validation - ${reasonToSkip}`);
      return false;
    }

    return true;
  });

  const publishedVersions = await listPackageVersions(packages, options);

  for (const pkg of packages) {
    const packageInfo = bumpInfo.packageInfos[pkg];
    console.log(`Validating package version - ${packageInfo.name}@${packageInfo.version}`);
    if (publishedVersions[pkg].includes(packageInfo.version)) {
      console.error(
        `\nERROR: Attempting to bump to a version that already exists in the registry: ${packageInfo.name}@${packageInfo.version}`
      );
      hasErrors = true;
    } else {
      console.log(' OK!\n');
    }
  }

  return !hasErrors;
}
