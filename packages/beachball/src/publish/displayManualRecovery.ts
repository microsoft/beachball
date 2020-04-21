import { BumpInfo } from '../types/BumpInfo';

export function displayManualRecovery(bumpInfo: BumpInfo, succeededPackages: Set<string> = new Set<string>()) {
  console.error('Something went wrong with the publish! Manually update these package and versions:');
  const succeededLines: string[] = [];

  bumpInfo.modifiedPackages.forEach(pkg => {
    const packageInfo = bumpInfo.packageInfos[pkg];
    const entry = `- ${packageInfo.name}@${packageInfo.version}`;
    if (succeededPackages.has(packageInfo.name)) {
      succeededLines.push(entry);
    } else {
      console.error(entry);
    }
  });

  if (succeededLines.length) {
    console.warn(
      'These packages and versions were successfully published, but may be invalid due to depending on ' +
        'package versions for which publishing failed:'
    );

    succeededLines.forEach(console.warn);

    console.warn(
      'To recover from this, you should run "beachball sync" to update local package.json ' +
        'files to synchronize package.json version. If necessary, unpublish any invalid packages from the above ' +
        'list after "beachball sync".'
    );
  }
}
