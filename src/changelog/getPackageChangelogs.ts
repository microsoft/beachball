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
    const { packageName, type: changeType, dependentChangeType, email, ...rest } = change;
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
    changelogs[packageName].comments[changeType] = changelogs[packageName].comments[changeType] || [];
    changelogs[packageName].comments[changeType]!.push({
      author: change.email,
      package: packageName,
      // This contains the comment and any extra properties added to the change file by
      // RepoOptions.changeFilePrompt.changePrompt
      ...rest,
      commit,
    });
  }
  return changelogs;
}
