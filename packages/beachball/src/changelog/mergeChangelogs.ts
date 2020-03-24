import _ from 'lodash';
import { PackageChangelog } from '../types/ChangeLog';

/**
 * Merge multiple PackageChangelog into one.
 * `name`, `date` and `version` will be using the values from master changelog. `comments` are merged.
 */
export function mergeChangelogs(masterChangelog: PackageChangelog, changelogs: PackageChangelog[]): PackageChangelog {
  if (changelogs.length < 1) {
    return masterChangelog;
  }

  const result = _.cloneDeep(masterChangelog);

  changelogs
    .filter(cl => cl.name !== masterChangelog.name)
    .forEach(changelog => {
      Object.keys(changelog.comments).forEach(changeType => {
        if (changelog.comments[changeType]) {
          result.comments[changeType] = (result.comments[changeType] || []).concat(changelog.comments[changeType]);
        }
      });
    });

  return result;
}
