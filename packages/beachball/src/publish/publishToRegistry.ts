import { performBump } from '../bump/performBump';
import { BumpInfo } from '../types/BumpInfo';
import { BeachballOptions } from '../types/BeachballOptions';
import { packagePublish } from '../packageManager/packagePublish';
import { validatePackageVersions } from './validatePackageVersions';
import { getBumpedPackages } from './getBumpedPackages';
import { displayManualRecovery } from './displayManualRecovery';
export function publishToRegistry(bumpInfo: BumpInfo, options: BeachballOptions) {
  const { path: cwd, registry, tag, token, access } = options;
  performBump(bumpInfo, cwd, options.bumpDeps);
  if (!validatePackageVersions(bumpInfo, registry)) {
    displayManualRecovery(bumpInfo);
    console.error('No packages have been published');
    process.exit(1);
  }
  getBumpedPackages(bumpInfo).forEach(pkg => {
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
