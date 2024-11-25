import type { PackageChangelog } from '../types/ChangeLog';
import type { PackageInfo } from '../types/PackageInfo';
import { generateTag } from '../git/generateTag';
import type { ChangeType } from '../types/ChangeInfo';

/**
 * Merge multiple package changelogs into one.
 * `name` and `version` will use the values from `primaryPackage`'s changelog.
 * `comments` are merged. `date` will be now.
 */
export function mergeChangelogs(
  changelogs: PackageChangelog[],
  primaryPackage: PackageInfo
): PackageChangelog | undefined {
  if (changelogs.length < 1 || !primaryPackage) {
    return undefined;
  }

  const result: PackageChangelog = {
    name: primaryPackage.name,
    version: primaryPackage.version,
    tag: generateTag(primaryPackage.name, primaryPackage.version),
    date: new Date(),
    comments: {},
  };

  for (const changelog of changelogs) {
    for (const changeType of Object.keys(changelog.comments) as ChangeType[]) {
      const comments = changelog.comments[changeType];
      if (comments?.length) {
        (result.comments[changeType] ??= []).push(...comments);
      }
    }
  }

  return result;
}
