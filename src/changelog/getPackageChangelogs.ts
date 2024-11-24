import path from 'path';
import type { PackageInfo } from '../types/PackageInfo';
import type { PackageChangelog } from '../types/ChangeLog';
import { generateTag } from '../git/generateTag';
import type { BumpInfo } from '../types/BumpInfo';
import { getChangePath } from '../paths';
import { getFileAddedHash } from 'workspace-tools';
import type { BeachballOptions } from '../types/BeachballOptions';

/**
 * Used for `ChangelogEntry.commit` if the commit hash is not available.
 */
const commitNotAvailable = 'not available';

/**
 * Get the preliminary changelog info for each modified package, based on change files and
 * possibly dependent bumps. (Omit `dependentChangedBy` to exclude dependent bumps.)
 * @returns Mapping from package name to package changelog.
 */
export function getPackageChangelogs(
  bumpInfo: Pick<BumpInfo, 'changeFileChangeInfos' | 'calculatedChangeTypes' | 'packageInfos'> &
    Partial<Pick<BumpInfo, 'dependentChangedBy'>>,
  options: Pick<BeachballOptions, 'path' | 'changeDir'>
): Record<string, PackageChangelog> {
  const { changeFileChangeInfos, calculatedChangeTypes, dependentChangedBy = {}, packageInfos } = bumpInfo;

  const changelogs: Record<string, PackageChangelog> = {};
  const changeFileCommits: { [changeFile: string]: string } = {};
  const changePath = getChangePath(options);

  for (const { change, changeFile } of changeFileChangeInfos) {
    const { packageName, type: changeType, dependentChangeType, email, ...rest } = change;
    changelogs[packageName] ??= createPackageChangelog(packageInfos[packageName]);

    changeFileCommits[changeFile] ??=
      getFileAddedHash(path.join(changePath, changeFile), options.path) || commitNotAvailable;

    changelogs[packageName].comments ??= {};
    changelogs[packageName].comments[changeType] ??= [];
    changelogs[packageName].comments[changeType].push({
      author: change.email,
      package: packageName,
      commit: changeFileCommits[changeFile],
      // This contains the comment and any extra properties added to the change file by
      // RepoOptions.changeFilePrompt.changePrompt
      ...rest,
    });
  }

  for (const [dependent, changedBy] of Object.entries(dependentChangedBy)) {
    if (packageInfos[dependent].private === true) {
      // Avoid creation of change log files for private packages since the version is
      // not managed by beachball and the log would only contain bumps to dependencies.
      continue;
    }

    changelogs[dependent] ??= createPackageChangelog(packageInfos[dependent]);

    const changeType = calculatedChangeTypes[dependent];

    changelogs[dependent].comments ??= {};
    changelogs[dependent].comments[changeType] ??= [];

    for (const dep of changedBy) {
      if (dep !== dependent) {
        changelogs[dependent].comments[changeType].push({
          author: 'beachball',
          package: dependent,
          comment: `Bump ${dep} to v${packageInfos[dep].version}`,
          // This change will be made in the commit that is currently being created, so unless we
          // split publishing into two commits (one for bumps and one for changelog updates),
          // there's no way to know the hash yet. It's better to record nothing than incorrect info.
          // https://github.com/microsoft/beachball/issues/901
          commit: commitNotAvailable,
        });
      }
    }
  }

  return changelogs;
}

function createPackageChangelog(packageInfo: PackageInfo): PackageChangelog {
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
