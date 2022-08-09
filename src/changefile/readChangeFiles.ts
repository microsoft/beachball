import { ChangeSet, ChangeInfo, ChangeInfoMultiple } from '../types/ChangeInfo';
import { getChangePath } from '../paths';
import fs from 'fs-extra';
import path from 'path';
import { BeachballOptions } from '../types/BeachballOptions';
import { getScopedPackages } from '../monorepo/getScopedPackages';
import { getChangesBetweenRefs } from 'workspace-tools';
import { PackageInfos } from '../types/PackageInfo';

export function readChangeFiles(options: BeachballOptions, packageInfos: PackageInfos): ChangeSet {
  const { path: cwd } = options;
  const scopedPackages = getScopedPackages(options, packageInfos);
  const changeSet: ChangeSet = [];
  const changePath = getChangePath(cwd);
  const fromRef = options.fromRef;

  if (!fs.existsSync(changePath)) {
    return changeSet;
  }

  const allChangeFiles = fs.readdirSync(changePath);
  const filteredChangeFiles: string[] = [];

  if (fromRef) {
    const changeFilesSinceFromRef = getChangesBetweenRefs(
      fromRef,
      'HEAD',
      [
        '--diff-filter=d', // excluding deleted files from the diff.
        '--relative', // results will include path relative to the cwd, i.e. only file names.
      ],
      '*.json',
      changePath
    );

    allChangeFiles
      .filter(fileName => changeFilesSinceFromRef?.includes(fileName))
      .forEach(fileName => filteredChangeFiles.push(fileName));
  } else {
    filteredChangeFiles.push(...allChangeFiles);
  }

  try {
    // sort the change files by modified time. Most recent modified file comes first.
    filteredChangeFiles.sort(function (f1, f2) {
      return (
        fs.statSync(path.join(changePath, f2)).mtime.getTime() - fs.statSync(path.join(changePath, f1)).mtime.getTime()
      );
    });
  } catch (err) {
    console.warn('Failed to sort change files', err);
  }

  filteredChangeFiles.forEach(changeFile => {
    const changeFilePath = path.join(changePath, changeFile);

    let changeInfo: ChangeInfo | ChangeInfoMultiple;
    try {
      changeInfo = fs.readJSONSync(changeFilePath);
    } catch (e) {
      console.warn(`Error reading or parsing change file ${changeFilePath}: ${e}`);
      return;
    }

    // Transform the change files, if the option is provided
    if (options.transform?.changeFiles) {
      try {
        changeInfo = options.transform?.changeFiles(changeInfo, changeFilePath);
      } catch (e) {
        console.warn(`Error transforming ${changeFilePath}: ${e}`);
        return;
      }
    }

    const changes: ChangeInfo[] = changeInfo.changes || [changeInfo as ChangeInfo];

    for (const change of changes) {
      if (scopedPackages.includes(change.packageName)) {
        changeSet.push({ changeFile, change });
      }
    }
  });

  return changeSet;
}
