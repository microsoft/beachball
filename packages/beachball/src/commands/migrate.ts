import type { PackageInfo as WSPackageInfo } from 'workspace-tools';
import type { BeachballOptions } from '../types/BeachballOptions';
import { getRawPackageInfos } from '../monorepo/getPackageInfos';
import { bulletedList, type BulletList } from '../logging/bulletedList';
import { BeachballError } from '../types/BeachballError';

/**
 * Handles the `beachball migrate` command.
 *
 * Checks the config for any settings that need to be updated for v3 and logs them to the console.
 * If no updates are needed, a success message is printed.
 */
export function migrate(options: Pick<BeachballOptions, 'path'>): void {
  const updates: BulletList = [];

  const rawPackageInfos = getRawPackageInfos({
    projectRoot: options.path,
    packageRoot: options.path,
    options,
  });

  if (rawPackageInfos) {
    checkShouldPublish(rawPackageInfos, updates);
  }

  if (updates.length === 0) {
    console.log('No config updates are needed for v3.');
  } else {
    console.log('The following updates are needed for v3:');
    console.log(bulletedList(updates));
    throw new BeachballError('Config updates needed', { alreadyLogged: true });
  }
}

function checkShouldPublish(rawPackageInfos: WSPackageInfo[], updates: BulletList): void {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const packagesWithShouldPublish = rawPackageInfos.filter(pkg => pkg.beachball?.shouldPublish === false);
  if (packagesWithShouldPublish.length) {
    updates.push(
      `The following packages use \`"shouldPublish": false\`, which is no longer supported. ` +
        'Typically you should use `"private": true` instead ' +
        `(if this doesn't work, please open an issue with details of your scenario).`,
      packagesWithShouldPublish.map(pkg => pkg.packageJsonPath)
    );
  }
}
