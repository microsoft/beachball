import _ from 'lodash';
import { PackageChangelog } from '../types/ChangeLog';
import { PackageInfo } from '../types/PackageInfo';
import { generateTag } from '../tag';
import { ChangeType } from '../types/ChangeInfo';

/**
 * Merge multiple PackageChangelog into one.
 * `name`, `date` and `version` will be using the values from master changelog. `comments` are merged.
 */
export function mergeChangelogs(
  changelogs: PackageChangelog[],
  masterPackage: PackageInfo,
  ignoreDependentChanges?: boolean,
): PackageChangelog | undefined {
  if (changelogs.length < 1 || !masterPackage) {
    return undefined;
  }

  const result: PackageChangelog = {
    name: masterPackage.name,
    version: masterPackage.version,
    tag: generateTag(masterPackage.name, masterPackage.version),
    date: new Date(),
    comments: {},
  };

  changelogs.forEach(changelog => {
    (Object.keys(changelog.comments) as ChangeType[]).forEach(changeType => {


      if (changelog.comments[changeType]) {
        let comments = changelog.comments[changeType]!;
        if (ignoreDependentChanges) {
          comments = comments.filter(changeLogEntry => !changeLogEntry.dependentChange);
        }

        result.comments[changeType] = (result.comments[changeType] || []).concat(comments);
      }
    });
  });

  return result;
}
