import { PackageInfo } from '../types/PackageInfo';
import { PackageChangelog } from '../types/ChangeLog';
import { generateTag } from '../tag';
import { BumpInfo } from '../types/BumpInfo';
import { getCurrentHash } from 'workspace-tools';

export function getPackageChangelogs(
  calculatedChangeInfo: BumpInfo['calculatedChangeInfos'],
  packageInfos: {
    [pkg: string]: PackageInfo;
  },
  cwd: string
) {
  const changeInfos = Object.values(calculatedChangeInfo);
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

    const changeLog = {
      comment: change.comment,
      author: change.email,
      commit,
      package: packageName
    }

    const changeLogKeys = Object.keys(change);

    // For handling custom schema of the changelog specified in the beachball config file
    for(const key of changeLogKeys){
      if(!changeLog[key] && key !== 'dependentChangeType'){
        changeLog[key] = change[key];
      }
    }

    changelogs[packageName].comments[change.type]!.push(changeLog);
  }
  return changelogs;
}
