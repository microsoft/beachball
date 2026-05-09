import { bulletedList, type BulletList } from '../logging/bulletedList';
import { BeachballError } from '../types/BeachballError';
import type { BeachballOptions } from '../types/BeachballOptions';

/**
 * Handles the `beachball migrate` command.
 *
 * Checks the config for any settings that need to be updated for v3 and logs them to the console.
 * If no updates are needed, a success message is printed.
 */
export function migrate(options: BeachballOptions): void {
  const updates: BulletList = [];

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

  if (updates.length === 0) {
    console.log('No config updates are needed for v3.');
  } else {
    console.error('The following updates are needed for v3:');
    console.error(bulletedList(updates));
    throw new BeachballError('Config updates are needed', { alreadyLogged: true });
  }
}
