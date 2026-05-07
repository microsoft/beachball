import { bulletedList } from '../logging/bulletedList';
import { singleLineStringify } from '../logging/singleLineStringify';
import type { ChangelogOptions } from '../types/ChangelogOptions';

export function isValidChangelogOptions(options: ChangelogOptions): boolean {
  if (!options.groups) {
    return true;
  }

  let isValid = true;

  const oldGroups = options.groups.filter(group => 'masterPackageName' in group);
  if (oldGroups.length) {
    isValid = false;
    console.error(
      'ERROR: "changelog.groups[*].masterPackageName" is renamed to "mainPackageName" in v3. ' +
        'Invalid groups:\n' +
        bulletedList(oldGroups.map(group => `masterPackageName "${group.masterPackageName as string}"`))
    );
  }

  const badGroups = options.groups.filter(
    group => !('masterPackageName' in group) && (!group.changelogPath || !group.mainPackageName || !group.include)
  );
  if (badGroups.length) {
    isValid = false;
    console.error(
      'ERROR: "changelog.groups" entries must define "changelogPath", "mainPackageName", and "include". ' +
        'Invalid groups:\n' +
        bulletedList(badGroups.map(group => singleLineStringify(group)))
    );
  }

  const badExcludeGroups = options.groups.filter(group => {
    const exclude = typeof group.exclude === 'string' ? [group.exclude] : group.exclude || [];
    return exclude.some((pattern: string) => pattern.startsWith('!'));
  });
  if (badExcludeGroups.length) {
    isValid = false;
    console.error(
      'ERROR: "changelog.groups[*].exclude" patterns must not start with "!" in v3. ' +
        'Found invalid groups:\n' +
        bulletedList(
          badExcludeGroups.map(
            group => `mainPackageName "${group.mainPackageName}": ${singleLineStringify(group.exclude)}`
          )
        )
    );
  }

  return isValid;
}
