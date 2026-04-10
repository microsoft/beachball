import { bulletedList } from '../logging/bulletedList';
import type { BumpInfo } from '../types/BumpInfo';

export function displayManualRecovery(
  bumpInfo: Pick<BumpInfo, 'modifiedPackages' | 'packageInfos'>,
  succeededPackages: Set<string> = new Set<string>()
): void {
  const errorLines: string[] = [];
  const succeededLines: string[] = [];

  for (const pkg of bumpInfo.modifiedPackages) {
    const packageInfo = bumpInfo.packageInfos[pkg];
    const entry = `${packageInfo.name}@${packageInfo.version}`;
    if (succeededPackages.has(packageInfo.name)) {
      succeededLines.push(entry);
    } else {
      errorLines.push(entry);
    }
  }

  console.error(
    'Something went wrong with publishing (see above for details). The following packages were NOT published:\n' +
      bulletedList(errorLines.sort()) +
      '\n'
  );

  if (succeededLines.length) {
    // Previously this warned about invalid packages on the registry (referencing unpublished versions),
    // but that should be impossible since packages are now published in topological order
    console.warn(
      'These packages and versions were successfully published, but will NOT be reflected in your local package.json files:\n' +
        bulletedList(succeededLines.sort()) +
        '\n\nTo recover from this, run "beachball sync" to synchronize local package.json files with the registry.\n'
    );
  }
}
