import { BumpInfo } from '../types/BumpInfo';
import { listPackageVersions } from '../packageManager/listPackageVersions';
import { NpmOptions } from '../types/NpmOptions';

export async function getNewPackages(bumpInfo: BumpInfo, options: NpmOptions) {
  const { modifiedPackages, packageInfos } = bumpInfo;

  const newPackages = Object.keys(packageInfos).filter(pkg => !modifiedPackages.has(pkg));

  const publishedVersions = await listPackageVersions(newPackages, options);

  return newPackages.filter(pkg => {
    if (!packageInfos[pkg].private && !publishedVersions[pkg]?.length) {
      console.log(`New package detected: ${pkg}`);
      return true;
    }
    return false;
  });
}
