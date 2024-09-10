import { BumpInfo } from '../types/BumpInfo';
import { listPackageVersions } from '../packageManager/listPackageVersions';
import { NpmOptions } from '../types/NpmOptions';

/**
 * Get package versions from the registry to determine if there are any new packages that didn't
 * have a change file. (This will only fetch packages *not* in `modifiedPackages`.)
 * @returns List of detected new packages
 */
export async function getNewPackages(
  bumpInfo: Pick<BumpInfo, 'modifiedPackages' | 'packageInfos'>,
  options: NpmOptions
): Promise<string[]> {
  const { modifiedPackages, packageInfos } = bumpInfo;

  const maybeNewPackages = Object.keys(packageInfos).filter(
    pkg => !modifiedPackages.has(pkg) && !packageInfos[pkg].private
  );

  const publishedVersions = await listPackageVersions(maybeNewPackages, options);

  return maybeNewPackages.filter(pkg => {
    if (!publishedVersions[pkg]?.length) {
      console.log(`New package detected: ${pkg}`);
      return true;
    }
    return false;
  });
}
