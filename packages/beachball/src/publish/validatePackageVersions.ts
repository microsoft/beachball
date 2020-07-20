import { BumpInfo } from '../types/BumpInfo';
import { listPackageVersions } from '../packageManager/listPackageVersions';
import { shouldPublishPackage } from './shouldPublishPackage';

/**
 * Validate a package being published is not already published.
 */
export async function validatePackageVersions(bumpInfo: BumpInfo, registry: string): Promise<boolean> {
  let hasErrors: boolean = false;

  const packages = [...bumpInfo.modifiedPackages].filter(pkg => {
    const { publish, reasonToSkip } = shouldPublishPackage(bumpInfo, pkg);
    if (!publish) {
      console.log(`Skipping package version validation - ${reasonToSkip}`);
      return false;
    }

    return true;
  });

  const publishedVersions = await listPackageVersions(packages, registry);

  for (const pkg of packages) {
    const packageInfo = bumpInfo.packageInfos[pkg];
    process.stdout.write(`Validating package version - ${packageInfo.name}@${packageInfo.version}`);
    if (publishedVersions[pkg].includes(packageInfo.version)) {
      console.error(
        `\nERROR: Attempting to bump to a version that already exists in the registry: ${packageInfo.name}@${packageInfo.version}`
      );
      hasErrors = true;
    } else {
      process.stdout.write(' OK!\n');
    }
  }

  return !hasErrors;
}
