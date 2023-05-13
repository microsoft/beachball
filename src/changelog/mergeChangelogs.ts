import _ from 'lodash';
import { PackageChangelog } from '../types/ChangeLog';
import { PackageInfo } from '../types/PackageInfo';
import { generateTag } from '../git/generateTag';
import { ChangeType } from '../types/ChangeInfo';

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

  changelogs.forEach(changelog => {
    (Object.keys(changelog.comments) as ChangeType[]).forEach(changeType => {
      if (changelog.comments[changeType]) {
        result.comments[changeType] = (result.comments[changeType] || []).concat(changelog.comments[changeType]!);
      }
    });
  });

  return result;
}
