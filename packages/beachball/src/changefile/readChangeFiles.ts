import { ChangeSet, ChangeInfo } from '../types/ChangeInfo';
import { getChangePath } from '../paths';
import fs from 'fs-extra';
import path from 'path';
import { BeachballOptions } from '../types/BeachballOptions';
import { getScopedPackages } from '../monorepo/getScopedPackages';
import { getFileAddedHash } from '../git';

export function readChangeFiles(options: BeachballOptions): ChangeSet {
  const { path: cwd } = options;
  const scopedPackages = getScopedPackages(options);
  const changeSet: ChangeSet = new Map();
  const changePath = getChangePath(cwd);
  if (!changePath || !fs.existsSync(changePath)) {
    return changeSet;
  }
  const changeFiles = fs.readdirSync(changePath);
  try {
    // sort the change files by modified time. Most recent modified file comes first.
    changeFiles.sort(function(f1, f2) {
      return (
        fs.statSync(path.join(changePath, f2)).mtime.getTime() - fs.statSync(path.join(changePath, f1)).mtime.getTime()
      );
    });
  } catch (err) {
    console.warn('Failed to sort change files', err);
  }

  changeFiles.forEach(changeFile => {
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
