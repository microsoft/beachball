import { BumpInfo } from '../types/BumpInfo';
import { getBumpedPackages } from './getBumpedPackages';
export function displayManualRecovery(bumpInfo: BumpInfo) {
  console.error('Something went wrong with the publish! Manually update these package and versions:');
  getBumpedPackages(bumpInfo).forEach(pkg => {
    const packageInfo = bumpInfo.packageInfos[pkg];
    console.error(`- ${packageInfo.name}@${packageInfo.version}`);
  });
}
