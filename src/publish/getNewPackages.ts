import { BumpInfo } from '../types/BumpInfo';
import { listPackageVersions } from '../packageManager/listPackageVersions';
import { NpmOptions } from '../types/NpmOptions';

export async function getNewPackages(
  bumpInfo: Pick<BumpInfo, 'modifiedPackages' | 'packageInfos'>,
  options: NpmOptions
): Promise<string[]> {
  const { modifiedPackages, packageInfos } = bumpInfo;

  const newPackages = Object.keys(packageInfos).filter(pkg => !modifiedPackages.has(pkg) && !packageInfos[pkg].private);

  const publishedVersions = await listPackageVersions(newPackages, options);

  return newPackages.filter(pkg => {
    if (!publishedVersions[pkg]?.length) {
      console.log(`New package detected: ${pkg}`);
      return true;
    }
    return false;
  });
}
