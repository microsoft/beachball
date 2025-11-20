import { bulletedList } from '../logging/bulletedList';
import { singleLineStringify } from '../logging/singleLineStringify';
import type { ChangelogOptions } from '../types/ChangelogOptions';

export function isValidChangelogOptions(options: ChangelogOptions): boolean {
  if (!options.groups) {
    return true;
  }

  const badGroups = options.groups.filter(
    group => !group.changelogPath || !('masterPackageName' in group || 'mainPackageName' in group) || !group.include
  );

  if (badGroups.length) {
    console.error(
      'ERROR: "changelog.groups" entries must define "changelogPath", "mainPackageName", and "include". ' +
        'Found invalid groups:\n' +
        bulletedList(badGroups.map(group => singleLineStringify(group)))
    );
    return false;
  }

  return true;
}
