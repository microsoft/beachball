import { BumpInfo } from '../types/BumpInfo';
import { listPackageVersions } from '../packageManager/listPackageVersions';

export function getNewPackages(bumpInfo: BumpInfo, registry: string) {
  const { modifiedPackages, packageInfos } = bumpInfo;

  const newPackages = Object.keys(packageInfos).filter(pkg => !modifiedPackages.has(pkg));

  return newPackages.filter(pkg => {
    const packageInfo = packageInfos[pkg];
    // Ignore private packages or change type "none" packages
    if (packageInfo.private) {
      return false;
    }

    const publishedVersions = listPackageVersions(packageInfo.name, registry);

    if (publishedVersions.length === 0) {
      console.log(`New package detected: ${pkg}`);
      return true;
    }
  });
}
