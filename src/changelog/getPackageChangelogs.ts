import { PackageInfo } from '../types/PackageInfo';
import { PackageChangelog } from '../types/ChangeLog';
import { generateTag } from '../tag';
import { BumpInfo } from '../types/BumpInfo';
import { getCurrentHash } from 'workspace-tools';
import { ChangeSet } from '../types/ChangeInfo';

export function getPackageChangelogs(
  changeFileChangeInfos: ChangeSet,
  calculatedChangeTypes: BumpInfo['calculatedChangeTypes'],
  dependentChangedBy: BumpInfo['dependentChangedBy'],
  packageInfos: {
    [pkg: string]: PackageInfo;
  },
  cwd: string
) {
  const changeInfos = changeFileChangeInfos.values();

  const changelogs: {
    [pkgName: string]: PackageChangelog;
  } = {};

  const commit = getCurrentHash(cwd) || 'not available';

  for (let change of changeInfos) {
    const { packageName, type: changeType, dependentChangeType, email, ...rest } = change;
    if (!changelogs[packageName]) {
      changelogs[packageName] = createChangeLog(packageInfos[packageName]);
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

  for (let [dependent, changedBy] of Object.entries(dependentChangedBy)) {
    if (!changelogs[dependent]) {
      changelogs[dependent] = createChangeLog(packageInfos[dependent]);
    }

    const changeType = calculatedChangeTypes[dependent];

    changelogs[dependent].comments = changelogs[dependent].comments || {};
    changelogs[dependent].comments[changeType] = changelogs[dependent].comments[changeType] || [];

    for (const dep of changedBy) {
      changelogs[dependent].comments[changeType]!.push({
        author: 'beachball',
        package: dependent,
        comment: `Bump ${dep} to v${packageInfos[dep].version}`,
        commit,
      });
    }
  }

  return changelogs;
}

function createChangeLog(packageInfo: PackageInfo) {
  const name = packageInfo.name;
  const version = packageInfo.version;
  return {
    name,
    version,
    tag: generateTag(name, version),
    date: new Date(),
    comments: {},
  };
}
