import type { BumpInfo } from '../types/BumpInfo';
import { listPackageVersions } from '../packageManager/listPackageVersions';
import type { NpmOptions } from '../types/NpmOptions';
import { bulletedList } from '../logging/bulletedList';

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

  const result = maybeNewPackages.filter(pkg => !publishedVersions[pkg]?.length);
  if (result.length) {
    console.log(`New package(s) detected:\n${bulletedList(result)}\n`);
  }
  return result;
}
