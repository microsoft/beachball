import { ChangeSet, ChangeInfo } from '../types/ChangeInfo';
import { getChangePath } from '../paths';
import fs from 'fs-extra';
import path from 'path';
import { BeachballOptions } from '../types/BeachballOptions';
import { getScopedPackages } from '../monorepo/getScopedPackages';
import { getFileAddedHash, getChangesBetweenRefs } from '../git';

export function readChangeFiles(options: BeachballOptions): ChangeSet {
  const { path: cwd } = options;
  const scopedPackages = getScopedPackages(options);
  const changeSet: ChangeSet = new Map();
  const changePath = getChangePath(cwd);
  const fromRef = options.fromRef;

  if (!changePath || !fs.existsSync(changePath)) {
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
    filteredChangeFiles.sort(function(f1, f2) {
      return (
        fs.statSync(path.join(changePath, f2)).mtime.getTime() - fs.statSync(path.join(changePath, f1)).mtime.getTime()
      );
    });
  } catch (err) {
    console.warn('Failed to sort change files', err);
  }

  filteredChangeFiles.forEach(changeFile => {
    try {
      const changeFilePath = path.join(changePath, changeFile);
      const changeInfo: ChangeInfo = {
        ...fs.readJSONSync(changeFilePath),
        // Add the commit hash where the file was actually first introduced
        commit: getFileAddedHash(changeFilePath, cwd) || '',
      };

      const packageName = changeInfo.packageName;
      if (scopedPackages.includes(packageName)) {
        changeSet.set(changeFile, changeInfo);
      } else {
        console.log(`Skipping reading change file for out-of-scope package ${packageName}`);
      }
    } catch (e) {
      console.warn(`Invalid change file detected: ${changeFile}`);
    }
  });
  return changeSet;
}
