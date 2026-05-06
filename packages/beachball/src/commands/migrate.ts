import fs from 'fs';
import path from 'path';
import { findPackageRoot, type PackageInfo as WSPackageInfo } from 'workspace-tools';
import { bulletedList, type BulletList } from '../logging/bulletedList';
import { getRawPackageInfos } from '../monorepo/getPackageInfos';
import { BeachballError } from '../types/BeachballError';
import type { BeachballOptions, ParsedOptions } from '../types/BeachballOptions';

/**
 * Handles the `beachball migrate` command.
 *
 * Checks the config for any settings that need to be updated for v3 and logs them to the console.
 * If no updates are needed, a success message is printed.
 */
export function migrate(parsedOptions: ParsedOptions): void {
  const { options, repoOptions } = parsedOptions;
  const updates: BulletList = [];
  const warnings: BulletList = [];

  const rawPackageInfos = getRawPackageInfos({
    projectRoot: options.path,
    packageRoot: findPackageRoot(options.path),
    options,
  });

  const groupUpdates: BulletList = [];
  for (const group of options.groups ?? []) {
    const exclude = typeof group.exclude === 'string' ? [group.exclude] : group.exclude || [];
    const negatedExclude = exclude.filter(p => p.startsWith('!'));
    if (negatedExclude.length) {
      groupUpdates.push(`Group "${group.name}"`, [
        'Remove the leading "!" from these `exclude` patterns:',
        negatedExclude,
      ]);
    }
  }
  if (groupUpdates.length) {
    updates.push('`groups`', groupUpdates);
  }

  const changelogGroupUpdates: BulletList = [];
  for (const group of options.changelog?.groups ?? []) {
    const thisGroupUpdates: BulletList = [];
    let mainPkg = group.mainPackageName as string | undefined;
    if (!mainPkg) {
      mainPkg = (group as { masterPackageName?: string }).masterPackageName;
      if (mainPkg) {
        thisGroupUpdates.push('Rename `masterPackageName` to `mainPackageName`');
      }
    }

    const exclude = typeof group.exclude === 'string' ? [group.exclude] : group.exclude || [];
    const negatedExclude = exclude.filter(p => p.startsWith('!'));
    if (negatedExclude.length) {
      thisGroupUpdates.push(`Remove the leading "!" from these \`exclude\` patterns:`, negatedExclude);
    }

    if (thisGroupUpdates.length) {
      changelogGroupUpdates.push(`Group for package "${mainPkg ?? '(missing)'}"`, thisGroupUpdates);
    }
  }
  if (changelogGroupUpdates.length) {
    updates.push('`changelog.groups`', changelogGroupUpdates);
  }

  if ((repoOptions as { new?: boolean }).new !== undefined) {
    updates.push('The `new` option has been removed. Please remove it from your config.');
  }

  if (rawPackageInfos) {
    checkShouldPublish({ rawPackageInfos, warnings, updates });
    checkChangelogJson({ rawPackageInfos, options, repoOptions, updates });
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

function checkChangelogJson(params: {
  rawPackageInfos: WSPackageInfo[];
  options: Pick<BeachballOptions, 'path'>;
  repoOptions: Pick<ParsedOptions['repoOptions'], 'generateChangelog' | 'changelog'>;
  updates: BulletList;
}): void {
  const { rawPackageInfos, options, repoOptions, updates } = params;
  if (repoOptions.generateChangelog !== undefined) {
    // skip the check if they have any explicit setting
    return;
  }

  const allChangelogJsons = [
    ...rawPackageInfos.map(pkg => path.join(path.dirname(pkg.packageJsonPath), 'CHANGELOG.json')),
    ...(repoOptions.changelog?.groups?.map(group =>
      path.resolve(options.path, group.changelogPath, 'CHANGELOG.json')
    ) ?? []),
  ];
  const changelogJsons = allChangelogJsons.filter(file => fs.existsSync(file));

  if (changelogJsons.length) {
    updates.push(
      'Found CHANGELOG.json files. In v3, CHANGELOG.json generation is disabled by default, ' +
        "since most repos don't use them (CHANGELOG.md is still generated).",
      [
        'If you DO want CHANGELOG.json files, set `generateChangelog: true` in your beachball config',
        'If you are NOT using CHANGELOG.json, delete these files:',
        changelogJsons.sort(),
      ]
    );
  }
}
