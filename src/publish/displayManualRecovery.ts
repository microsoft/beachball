import type { BumpInfo } from '../types/BumpInfo';

export function displayManualRecovery(bumpInfo: BumpInfo, succeededPackages: Set<string> = new Set<string>()): void {
  const errorLines: string[] = [];
  const succeededLines: string[] = [];

  bumpInfo.modifiedPackages.forEach(pkg => {
    const packageInfo = bumpInfo.packageInfos[pkg];
    const entry = `- ${packageInfo.name}@${packageInfo.version}`;
    if (succeededPackages.has(packageInfo.name)) {
      succeededLines.push(entry);
    } else {
      errorLines.push(entry);
    }
  });

  console.error(
    'Something went wrong with publishing! Manually update these package and versions:\n' + errorLines.sort().join('\n')
  );

  if (succeededLines.length) {
    console.warn(
      'These packages and versions were successfully published, but may be invalid if they depend on ' +
        'package versions for which publishing failed:\n' +
        succeededLines.sort().join('\n') +
        '\n\nTo recover from this, run "beachball sync" to synchronize local package.json files with the registry. ' +
        'If necessary, unpublish or deprecate any invalid packages from the above list after "beachball sync".'
    );
  }
}
