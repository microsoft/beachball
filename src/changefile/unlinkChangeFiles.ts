import { ChangeSet } from '../types/ChangeInfo';
import { getChangePath } from '../paths';
import fs from 'fs-extra';
import path from 'path';
import { PackageInfo } from '../types/PackageInfo';

/**
 * Unlink only change files that are specified in the changes param
 *
 * @param changes existing change files to be removed
 * @returns List of of change file paths that have been unlinked
 */
export function unlinkChangeFiles(
  changeSet: ChangeSet,
  packageInfos: {
    [pkg: string]: PackageInfo;
  },
  cwd: string
): string[] {
  const changePath = getChangePath(cwd);
  const modifiedChangeFiles: string[] = [];

  if (!changePath || !changeSet || !changeSet.length) {
    return [];
  }
  console.log('Removing change files:');
  for (let { changeFile, change } of changeSet) {
    if (changeFile && packageInfos[change.packageName] && !packageInfos[change.packageName].private) {
      console.log(`- ${changeFile}`);
      const changeFilePath = path.join(changePath, changeFile);
      fs.removeSync(changeFilePath);
      modifiedChangeFiles.push(changeFilePath);
    }
  }
  if (fs.existsSync(changePath) && fs.readdirSync(changePath).length === 0) {
    console.log('Removing change path');
    fs.removeSync(changePath);

    // Add to modified list since the empty dir needs to be removed
    modifiedChangeFiles.push(changePath);
  }

  return modifiedChangeFiles;
}
