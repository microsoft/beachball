import { BumpInfo } from '../types/BumpInfo';
export function displayManualRecovery(bumpInfo: BumpInfo) {
  console.error('Something went wrong with the publish! Manually update these package and versions:');
  bumpInfo.modifiedPackages.forEach(pkg => {
    const packageInfo = bumpInfo.packageInfos[pkg];
    console.error(`- ${packageInfo.name}@${packageInfo.version}`);
  });
}
