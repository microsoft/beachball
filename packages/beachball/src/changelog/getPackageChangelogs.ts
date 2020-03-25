import { ChangeSet } from '../types/ChangeInfo';
import { PackageInfo } from '../types/PackageInfo';
import { PackageChangelog } from '../types/ChangeLog';

export function getPackageChangelogs(
  changeSet: ChangeSet,
  packageInfos: {
    [pkg: string]: PackageInfo;
  }
) {
  const changelogs: {
    [pkgName: string]: PackageChangelog;
  } = {};
  for (let [_, change] of changeSet) {
    const { packageName } = change;
    changelogs[packageName] = changelogs[packageName] || {
      name: packageName,
      version: packageInfos[packageName].version,
      date: new Date(),
    };
    changelogs[packageName].comments = changelogs[packageName].comments || {};
    changelogs[packageName].comments[change.type] = changelogs[packageName].comments[change.type] || [];
    changelogs[packageName].comments[change.type]!.push({
      comment: change.comment,
      author: change.email,
      commit: change.commit,
      package: packageInfos[packageName],
    });
  }
  return changelogs;
}
