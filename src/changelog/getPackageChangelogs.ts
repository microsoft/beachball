import { PackageInfo } from '../types/PackageInfo';
import { PackageChangelog } from '../types/ChangeLog';
import { generateTag } from '../tag';
import { BumpInfo } from '../types/BumpInfo';
import { getCurrentHash } from 'workspace-tools';
import { ChangeSet } from '../types/ChangeInfo';

export function getPackageChangelogs(
  changeFileChangeInfos: ChangeSet,
  dependentChangeInfos: BumpInfo['dependentChangeInfos'],
  packageInfos: {
    [pkg: string]: PackageInfo;
  },
  cwd: string
) {
  const changeInfos = Array.from(changeFileChangeInfos.values()).concat(Object.values(dependentChangeInfos));
  const changelogs: {
    [pkgName: string]: PackageChangelog;
  } = {};

  const commit = getCurrentHash(cwd) || 'not available';

  for (let change of changeInfos) {
    const { packageName } = change;
    if (!changelogs[packageName]) {
      const version = packageInfos[packageName].version;
      changelogs[packageName] = {
        name: packageName,
        version,
        tag: generateTag(packageName, version),
        date: new Date(),
        comments: {},
      };
    }

    changelogs[packageName].comments = changelogs[packageName].comments || {};
    changelogs[packageName].comments[change.type] = changelogs[packageName].comments[change.type] || [];
    changelogs[packageName].comments[change.type]!.push({
      comment: change.comment,
      author: change.email,
      commit,
      package: packageName,
    });
  }
  return changelogs;
}
