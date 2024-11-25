import { singleLineStringify } from '../logging/format';
import type { ChangelogOptions } from '../types/ChangelogOptions';

export function isValidChangelogOptions(options: ChangelogOptions): boolean {
  if (!options.groups) {
    return true;
  }

  const badGroups = options.groups.filter(group => !group.changelogPath || !group.masterPackageName || !group.include);

  if (badGroups.length) {
    console.error(
      'ERROR: "changelog.groups" entries must define "changelogPath", "masterPackageName", and "include". ' +
        'Found invalid groups:\n' +
        badGroups.map(group => '  ' + singleLineStringify(group)).join('\n')
    );
    return false;
  }

  return true;
}
