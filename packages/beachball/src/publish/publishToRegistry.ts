import { performBump } from '../bump/performBump';
import { BumpInfo } from '../types/BumpInfo';
import { BeachballOptions } from '../types/BeachballOptions';
import { packagePublish } from '../packageManager/packagePublish';
import { validatePackageVersions } from './validatePackageVersions';
import { displayManualRecovery } from './displayManualRecovery';
import { getNewPackages } from './getNewPackages';
export function publishToRegistry(bumpInfo: BumpInfo, options: BeachballOptions) {
  const { registry, tag, token, access } = options;
  const { modifiedPackages, newPackages } = bumpInfo;

  performBump(bumpInfo, options);

  if (!validatePackageVersions(bumpInfo, registry)) {
    displayManualRecovery(bumpInfo);
    console.error('No packages have been published');
    process.exit(1);
  }

  [...modifiedPackages, ...newPackages].forEach(pkg => {
    const packageInfo = bumpInfo.packageInfos[pkg];
    const changeType = bumpInfo.packageChangeTypes[pkg];
    if (changeType === 'none') {
      return;
    }
    if (!packageInfo.private) {
      console.log(`Publishing - ${packageInfo.name}@${packageInfo.version}`);
      const result = packagePublish(packageInfo, registry, token, tag, access);
      if (result.success) {
        console.log('Published!');
      } else {
        displayManualRecovery(bumpInfo);
        console.error(result.stderr);
        process.exit(1);
        return;
      }
    } else {
      console.warn(
        `Skipping publish of ${packageInfo.name} since it is marked private. Version has been bumped to ${packageInfo.version}`
      );
    }
  });
  return;
}
