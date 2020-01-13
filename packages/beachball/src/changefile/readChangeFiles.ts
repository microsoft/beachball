import { ChangeSet } from '../types/ChangeInfo';
import { getChangePath } from '../paths';
import fs from 'fs-extra';
import path from 'path';
export function readChangeFiles(cwd: string) {
  const changeSet: ChangeSet = new Map();
  const changePath = getChangePath(cwd);
  if (!changePath || !fs.existsSync(changePath)) {
    return changeSet;
  }
  const changeFiles = fs.readdirSync(changePath);
  changeFiles.forEach(changeFile => {
    try {
      const packageJson = JSON.parse(fs.readFileSync(path.join(changePath, changeFile)).toString());
      changeSet.set(changeFile, packageJson);
    } catch (e) {
      console.warn(`Invalid change file detected: ${changeFile}`);
    }
  });
  return changeSet;
}
