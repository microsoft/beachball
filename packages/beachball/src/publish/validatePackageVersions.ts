import { BumpInfo } from '../types/BumpInfo';
import { listPackageVersions } from '../packageManager/listPackageVersions';

export function validatePackageVersions(bumpInfo: BumpInfo, registry: string) {
  let hasErrors: boolean = false;
  bumpInfo.modifiedPackages.forEach(pkg => {
    const packageInfo = bumpInfo.packageInfos[pkg];
    const changeType = bumpInfo.packageChangeTypes[pkg];

    if (changeType === 'none') {
      console.log(`Skipping change type as none package ${pkg}`);
      return;
    }

    if (packageInfo.private) {
      console.log(`Skipping private package ${pkg}`);
      return;
    }
    if (!bumpInfo.scopedPackages.has(pkg)) {
      console.log(`Skipping out-of-scope package ${pkg}`);
      return;
    }

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
