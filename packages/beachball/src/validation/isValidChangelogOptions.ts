import { bulletedList } from '../logging/bulletedList';
import { singleLineStringify } from '../logging/singleLineStringify';
import type { ChangelogOptions } from '../types/ChangelogOptions';

/**
 * Verify that any `options.groups` contain the required properties.
 */
export function isValidChangelogOptions(options: ChangelogOptions): boolean {
  if (options.groups !== undefined && !Array.isArray(options.groups)) {
    console.error(
      'ERROR: Expected "changelog.groups" configuration setting to be an array. Received:\n' +
        singleLineStringify(options.groups)
    );
    return false;
  }

  const badGroups = options.groups?.filter(group => !group.changelogPath || !group.mainPackageName || !group.include);
  if (badGroups?.length) {
    console.error(
      'ERROR: "changelog.groups" entries must define "changelogPath", "mainPackageName", and "include". ' +
        'Invalid groups:\n' +
        bulletedList(badGroups.map(group => singleLineStringify(group)))
    );
    return false;
  }

  return true;
}
