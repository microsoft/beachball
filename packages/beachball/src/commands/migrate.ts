import type { ParsedOptions } from '../types/BeachballOptions';
import { findPackageRoot, type PackageInfo as WSPackageInfo } from 'workspace-tools';
import { getRawPackageInfos } from '../monorepo/getPackageInfos';
import { bulletedList, type BulletList } from '../logging/bulletedList';
import { BeachballError } from '../types/BeachballError';

/**
 * Handles the `beachball migrate` command.
 *
 * Checks the config for any settings that need to be updated for v3 and logs them to the console.
 * If no updates are needed, a success message is printed.
 */
export function migrate(parsedOptions: ParsedOptions): void {
  const { options } = parsedOptions;
  const updates: BulletList = [];
  const warnings: BulletList = [];

  const rawPackageInfos = getRawPackageInfos({
    projectRoot: options.path,
    packageRoot: findPackageRoot(options.path),
    options,
  });

  if ((options as { new?: boolean }).new !== undefined) {
    updates.push('The `new` option has been removed. Please remove it from your config.');
  }

  if (rawPackageInfos) {
    checkShouldPublish({ rawPackageInfos, warnings, updates });
  }

  if (!updates.length && !warnings.length) {
    console.log('No config updates are needed for v3.');
  }
  if (warnings.length) {
    console.warn(`The following warnings were found for your config:`);
    console.warn(bulletedList(warnings) + '\n');
  }
  if (updates.length) {
    console.error('The following updates are needed for v3:');
    console.error(bulletedList(updates) + '\n');
    throw new BeachballError('Config updates needed', { alreadyLogged: true });
  }
}

function checkShouldPublish(params: {
  rawPackageInfos: WSPackageInfo[];
  warnings: BulletList;
  updates: BulletList;
}): void {
  const { rawPackageInfos, warnings, updates } = params;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const packagesWithShouldPublish = rawPackageInfos.filter(pkg => pkg.beachball?.shouldPublish === false);
  const privatePackagesWithShouldPublish = packagesWithShouldPublish.filter(pkg => pkg.private);
  const publicPackagesWithShouldPublish = packagesWithShouldPublish.filter(pkg => !pkg.private);

  if (privatePackagesWithShouldPublish.length) {
    updates.push(
      'Found private packages using `"shouldPublish": false`. ' +
        'This setting does nothing with private packages and should be removed.',
      privatePackagesWithShouldPublish.map(pkg => pkg.packageJsonPath).sort()
    );
  }

  if (publicPackagesWithShouldPublish.length) {
    warnings.push(
      'Found non-private packages using `"shouldPublish": false`. The behavior of this setting has changed--' +
        'please see the v3 migration guide for details and verify it still works for your scenario.',
      publicPackagesWithShouldPublish.map(pkg => pkg.packageJsonPath).sort()
    );
  }
}
