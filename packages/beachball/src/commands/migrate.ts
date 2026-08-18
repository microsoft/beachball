import fs from 'node:fs';
import path from 'node:path';
import type { PackageInfo as WSPackageInfo } from 'workspace-tools';
import { bulletedList, type BulletList } from '../logging/bulletedList';
import { getRawPackageInfos } from '../monorepo/getPackageInfos';
import { BeachballError } from '../types/BeachballError';
import type { PackageOptions, ParsedOptions } from '../types/BeachballOptions';

type Migration = (params: {
  parsedOptions: ParsedOptions;
  rawPackageInfos: WSPackageInfo[] | undefined;
  updates: BulletList;
  warnings: BulletList;
}) => void;
type MigrationName =
  | 'groups'
  | 'changelogGroups'
  | 'new'
  | 'changeFilePrompt'
  | 'packStyle'
  | 'prebump'
  | 'shouldPublish'
  | 'changelogJson'
  | 'nullTag';
// WARNING: If adding a new migration, consider whether it should be skipped in validate()

/**
 * Handles the `beachball migrate` command.
 *
 * Checks the config for any settings that need to be updated for v3 and logs them to the console.
 * If no updates are needed, a success message is printed.
 */
export function migrate(parsedOptions: ParsedOptions): void {
  const rawPackageInfos = getRawPackageInfos(parsedOptions.options);
  const { updates, warnings } = getMigrationIssues({ parsedOptions, rawPackageInfos });

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

/**
 * Get a list of migration issues for the given config and packageInfos.
 *
 * **WARNING:** This is also run during pre-command `validate()`, so any file reads should be shared
 * (why `rawPackageInfos` are passed in), or disabled in `validate()` with `skipMigrations`.
 */
export function getMigrationIssues(params: {
  parsedOptions: ParsedOptions;
  rawPackageInfos: WSPackageInfo[] | undefined;
  skipMigrations?: MigrationName[];
}): {
  /** Required updates which will also cause `validate()` to fail */
  updates: BulletList;
  /** Warnings about potential issues */
  warnings: BulletList;
} {
  const { parsedOptions, rawPackageInfos, skipMigrations } = params;

  const updates: BulletList = [];
  const warnings: BulletList = [];

  for (const [migrationName, migration] of Object.entries(migrations)) {
    if (!skipMigrations?.includes(migrationName as MigrationName)) {
      migration({ parsedOptions, rawPackageInfos, updates, warnings });
    }
  }

  return { updates, warnings };
}

const migrations: Record<MigrationName, Migration> = {
  groups: ({ parsedOptions: { options }, updates }) => {
    if (!Array.isArray(options.groups)) return;

    const groupUpdates: BulletList = [];
    for (const group of options.groups) {
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
  },
  changelogGroups: ({ parsedOptions: { options }, updates }) => {
    if (!Array.isArray(options.changelog?.groups)) return;

    const changelogGroupUpdates: BulletList = [];
    for (const group of options.changelog.groups) {
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
  },
  new: ({ parsedOptions: { repoOptions }, updates }) => {
    if (Object.hasOwn(repoOptions, 'new')) {
      updates.push('The `new` option has been removed. Please remove it from your config.');
    }
  },
  packStyle: ({ parsedOptions: { repoOptions }, updates }) => {
    if (Object.hasOwn(repoOptions, 'packStyle')) {
      updates.push(
        'The `packStyle` option has been removed (packing always uses the layered style now). ' +
          'Please remove it from your config.'
      );
    }
  },
  prebump: ({ parsedOptions: { repoOptions }, updates }) => {
    if ((repoOptions.hooks?.prebump?.length ?? 0) > 3) {
      updates.push('`hooks.prebump` no longer receives `packageInfos`. See migration guide.');
    }
  },
  changeFilePrompt: ({ parsedOptions: { repoOptions }, updates }) => {
    if ((repoOptions as { changeFilePrompt?: unknown }).changeFilePrompt !== undefined) {
      updates.push('The `changeFilePrompt` option has been renamed to `changeFile`.');
    }
  },
  shouldPublish: ({ rawPackageInfos, updates, warnings }) => {
    if (!rawPackageInfos) return;

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

    return { updates, warnings };
  },
  changelogJson: ({ rawPackageInfos, parsedOptions: { repoOptions, options }, updates }) => {
    if (!rawPackageInfos || repoOptions.generateChangelog !== undefined) {
      // skip the check if they have any explicit setting
      return;
    }

    const allChangelogJsons = new Set([
      ...rawPackageInfos.map(pkg => path.join(path.dirname(pkg.packageJsonPath), 'CHANGELOG.json')),
      ...(repoOptions.changelog?.groups?.map(group =>
        path.resolve(options.path, group.changelogPath, 'CHANGELOG.json')
      ) ?? []),
    ]);
    const changelogJsons = Array.from(allChangelogJsons).filter(file => fs.existsSync(file));

    if (changelogJsons.length) {
      // This is handled as an error because an explicit setting is required to keep the old behavior,
      // so it's good to fail loudly in case a repo is actually using CHANGELOG.json instead of
      // silently no longer updating it.
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
  },
  nullTag: ({ rawPackageInfos, parsedOptions: { repoOptions, configPath }, updates, warnings }) => {
    if (!rawPackageInfos) return;

    const packagesWithNullTag = rawPackageInfos
      .filter(pkg => (pkg.beachball as PackageOptions)?.tag === null)
      .map(p => p.packageJsonPath);
    const packagesWithEmptyTag = rawPackageInfos
      .filter(pkg => (pkg.beachball as PackageOptions)?.tag === '')
      .map(p => p.packageJsonPath);
    const packagesWithEmptyDefaultTag = rawPackageInfos
      .filter(pkg => (pkg.beachball as PackageOptions)?.defaultNpmTag === '')
      .map(p => p.packageJsonPath);

    repoOptions.tag === null && packagesWithNullTag.unshift(configPath ?? 'repo config');
    repoOptions.tag === '' && packagesWithEmptyTag.unshift(configPath ?? 'repo config');
    repoOptions.defaultNpmTag === '' && packagesWithEmptyDefaultTag.unshift(configPath ?? 'repo config');

    if (packagesWithNullTag.length) {
      updates.push(
        'Found setting(s) `tag: null`. This is ignored. ' +
          '(You can set "tag": "" to fall back to defaultNpmTag or "latest", ' +
          "but it's not possible to publish a new version without an npm dist-tag.)",
        packagesWithNullTag.sort()
      );
    }
    if (packagesWithEmptyTag.length) {
      warnings.push(
        'Found setting(s) `tag: ""`. This is valid, but it will fall back to defaultNpmTag or "latest". ' +
          "(It's not possible to publish a new version without an npm dist-tag.)",
        packagesWithEmptyTag.sort()
      );
    }
    if (packagesWithEmptyDefaultTag.length) {
      updates.push(
        'Found setting(s) `defaultNpmTag: ""`. This is invalid. ' +
          "(It's not possible to publish a new version without an npm dist-tag.)",
        packagesWithEmptyDefaultTag.sort()
      );
    }
  },
};
