import { BumpInfo } from '../types/BumpInfo';
import { listPackageVersions } from '../packageManager/listPackageVersions';
import { shouldPublishPackage } from './shouldPublishPackage';
import { NpmOptions } from '../types/NpmOptions';
import { formatList } from '../logging/format';

/**
 * Validate each package version being published doesn't already exist in the registry.
 */
export async function validatePackageVersions(bumpInfo: BumpInfo, options: NpmOptions): Promise<boolean> {
  console.log('\nValidating new package versions...');

  const packagesToValidate = [...bumpInfo.modifiedPackages].filter(pkg => {
    const { publish, reasonToSkip } = shouldPublishPackage(bumpInfo, pkg);
    if (!publish) {
      console.log(`Skipping package version validation - ${reasonToSkip}`);
      return false;
    }

    return true;
  });

  const publishedVersions = await listPackageVersions(packagesToValidate, options);

  const okVersions: string[] = [];
  const errorVersions: string[] = [];

  for (const pkg of packagesToValidate) {
    const packageInfo = bumpInfo.packageInfos[pkg];
    const versionSpec = `${packageInfo.name}@${packageInfo.version}`;
    if (publishedVersions[pkg].includes(packageInfo.version)) {
      errorVersions.push(versionSpec);
    } else {
      okVersions.push(versionSpec);
    }
  }

  if (okVersions.length) {
    console.log(`\nPackage versions are OK to publish:\n${formatList(okVersions)}`);
  }
  if (errorVersions.length) {
    console.error(
      `\nERROR: Attempting to publish package versions that already exist in the registry:\n` +
        formatList(errorVersions)
    );
    return false;
  }

  return true;
}
