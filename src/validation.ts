import { getChangePath } from './paths';
import fs from 'fs';
import path from 'path';
import { getChangedPackages } from './getChangedPackages';
import { ChangeInfo } from './ChangeInfo';

/**
 * See if change files are needed
 *
 * 1. If there is no changePath, make sure there's no changed packages
 * 2. If there are changed packages, find matching change files
 *
 * @param cwd
 */
export function isChangeFileNeeded(cwd?: string) {
  const changePath = getChangePath(cwd);
  const changedPackages = getChangedPackages(cwd);

  if (!changePath || !fs.existsSync(changePath)) {
    return changedPackages.length > 0;
  }

  const changeFileDirents = fs.readdirSync(changePath, { withFileTypes: true });
  const changeFiles = changeFileDirents.filter(dirent => dirent.isFile).map(dirent => dirent.name);
  const changeFilePackageSet = new Set<string>();
  changeFiles.forEach(file => {
    try {
      const changeInfo: ChangeInfo = JSON.parse(fs.readFileSync(path.join(changePath, file)).toString());
      changeFilePackageSet.add(changeInfo.packageName);
    } catch (e) {
      console.warn(`Invalid change file encountered: ${file}`);
    }
  });

  const missingPackageNames = changedPackages.filter(pkgName => !changeFilePackageSet.has(pkgName));
  return missingPackageNames.length > 0;
}
