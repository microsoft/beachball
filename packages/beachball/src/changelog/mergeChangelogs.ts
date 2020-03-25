import _ from 'lodash';
import { PackageChangelog } from '../types/ChangeLog';
import { PackageInfo } from '../types/PackageInfo';

/**
 * Merge multiple PackageChangelog into one.
 * `name`, `date` and `version` will be using the values from master changelog. `comments` are merged.
 */
export function mergeChangelogs(
  changelogs: PackageChangelog[],
  masterPackage: PackageInfo
): PackageChangelog | undefined {
  if (changelogs.length < 1 || !masterPackage) {
    return undefined;
  }

  const result: PackageChangelog = {
    name: masterPackage.name,
    version: masterPackage.version,
    date: new Date(),
    comments: {},
  };

  changelogs.forEach(changelog => {
    Object.keys(changelog.comments).forEach(changeType => {
      if (changelog.comments[changeType]) {
        result.comments[changeType] = (result.comments[changeType] || []).concat(changelog.comments[changeType]);
      }
    });
  });

  return result;
}
