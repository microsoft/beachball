import path from 'path';
import { PackageInfo } from '../types/PackageInfo';
import { PackageChangelog } from '../types/ChangeLog';
import { generateTag } from '../git/generateTag';
import { BumpInfo } from '../types/BumpInfo';
import { getChangePath } from '../paths';
import { getCurrentHash, getFileAddedHash } from 'workspace-tools';
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
  const changelogs: {
    [pkgName: string]: PackageChangelog;
  } = {};

  const changeFileCommits: { [changeFile: string]: string } = {};
  const changePath = getChangePath(cwd);

  for (let { change, changeFile } of changeFileChangeInfos) {
    const { packageName, type: changeType, dependentChangeType, email, ...rest } = change;
    if (!changelogs[packageName]) {
      changelogs[packageName] = createChangeLog(packageInfos[packageName]);
    }

    if (!changeFileCommits[changeFile]) {
      changeFileCommits[changeFile] = getFileAddedHash(path.join(changePath, changeFile), cwd) || 'not available';
    }

    changelogs[packageName].comments = changelogs[packageName].comments || {};
    changelogs[packageName].comments[changeType] = changelogs[packageName].comments[changeType] || [];
    changelogs[packageName].comments[changeType]!.push({
      author: change.email,
      package: packageName,
      commit: changeFileCommits[changeFile],
      // This contains the comment and any extra properties added to the change file by
      // RepoOptions.changeFilePrompt.changePrompt
      ...rest,
    });
  }

  const commit = getCurrentHash(cwd) || 'not available';

  for (let [dependent, changedBy] of Object.entries(dependentChangedBy)) {
    if (packageInfos[dependent].private === true) {
      // Avoid creation of change log files for private packages since the version is
      // not managed by beachball and the log would only contain bumps to dependencies.
      continue;
    }

    if (!changelogs[dependent]) {
      changelogs[dependent] = createChangeLog(packageInfos[dependent]);
    }

    const changeType = calculatedChangeTypes[dependent];

    changelogs[dependent].comments = changelogs[dependent].comments || {};
    changelogs[dependent].comments[changeType] = changelogs[dependent].comments[changeType] || [];

    for (const dep of changedBy) {
      if (dep !== dependent) {
        changelogs[dependent].comments[changeType]!.push({
          author: 'beachball',
          package: dependent,
          comment: `Bump ${dep} to v${packageInfos[dep].version}`,
          commit,
        });
      }
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
