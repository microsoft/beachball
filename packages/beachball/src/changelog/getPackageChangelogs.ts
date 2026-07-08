import path from 'path';
import type { PackageInfo } from '../types/PackageInfo';
import type { PackageChangelog } from '../types/ChangeLog';
import type { BumpInfo } from '../types/BumpInfo';
import { getChangePath } from '../paths';
import { getFileAddedHash } from 'workspace-tools';
import type { BeachballOptions } from '../types/BeachballOptions';

/**
 * Get the preliminary changelog info for each modified package, based on change files and
 * possibly dependent bumps. (Omit `dependentChangedBy` to exclude dependent bumps.)
 * @returns Mapping from package name to package changelog.
 */
export function getPackageChangelogs(
  bumpInfo: Pick<BumpInfo, 'changeFileChangeInfos' | 'calculatedChangeTypes' | 'packageInfos' | 'packageTags'> &
    Partial<Pick<BumpInfo, 'dependentChangedBy'>>,
  options: Pick<BeachballOptions, 'path' | 'changeDir' | 'changelog'>
): Record<string, PackageChangelog> {
  const { changeFileChangeInfos, calculatedChangeTypes, dependentChangedBy = {}, packageInfos, packageTags } = bumpInfo;
  const includeCommitHashes = options.changelog?.includeCommitHashes !== false;

  const changelogs: Record<string, PackageChangelog> = {};
  const changeFileCommits: { [changeFile: string]: string | undefined } = {};
  const changePath = getChangePath(options);

  for (const { change, changeFile } of changeFileChangeInfos) {
    const { packageName, type: changeType, dependentChangeType, email, ...rest } = change;
    changelogs[packageName] ??= createPackageChangelog(packageInfos[packageName], packageTags[packageName]?.[0]);

    if (includeCommitHashes && !(changeFile in changeFileCommits)) {
      changeFileCommits[changeFile] =
        getFileAddedHash({ filename: path.join(changePath, changeFile), cwd: options.path }) || undefined;
    }
    const commit = changeFileCommits[changeFile];

    changelogs[packageName].comments ??= {};
    changelogs[packageName].comments[changeType] ??= [];
    changelogs[packageName].comments[changeType].push({
      author: change.email,
      package: packageName,
      ...(commit !== undefined && { commit }),
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

    const changeType = calculatedChangeTypes[dependent];
    if (!changeType) {
      // Either bumpDeps is false, or the dependent is out of scope, so skip writing changelogs.
      // (Related issue for why the package ends up in dependentChangedBy at all: https://github.com/microsoft/beachball/issues/1123)
      continue;
    }

    changelogs[dependent] ??= createPackageChangelog(packageInfos[dependent], packageTags[dependent]?.[0]);

    changelogs[dependent].comments ??= {};
    changelogs[dependent].comments[changeType] ??= [];

    for (const dep of changedBy) {
      if (dep !== dependent) {
        changelogs[dependent].comments[changeType].push({
          author: 'beachball',
          package: dependent,
          comment: `Bump ${dep} to v${packageInfos[dep].version}`,
        });
      }
    }
  }

  return changelogs;
}

function createPackageChangelog(packageInfo: PackageInfo, gitTag: string | undefined): PackageChangelog {
  return {
    name: packageInfo.name,
    version: packageInfo.version,
    ...(gitTag !== undefined && { tag: gitTag }),
    date: new Date(),
    comments: {},
  };
}
