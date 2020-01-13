import { ChangeInfo } from '../types/ChangeInfo';
import { getChangePath } from '../paths';
import { getBranchName, stageAndCommit } from '../git';
import fs from 'fs-extra';
import path from 'path';
import { getTimeStamp } from './getTimeStamp';
/**
 * Loops through the `changes` and writes out a list of change files
 * @param changes
 * @param cwd
 */
export function writeChangeFiles(
  changes: {
    [pkgname: string]: ChangeInfo;
  },
  cwd: string
) {
  if (Object.keys(changes).length === 0) {
    return;
  }
  const changePath = getChangePath(cwd);
  const branchName = getBranchName(cwd);
  if (changePath && !fs.existsSync(changePath)) {
    fs.mkdirpSync(changePath);
  }
  if (changes && branchName && changePath) {
    const changeFiles: string[] = [];
    Object.keys(changes).forEach(pkgName => {
      const suffix = branchName.replace(/[\/\\]/g, '-');
      const prefix = pkgName.replace(/[^a-zA-Z0-9@]/g, '-');
      const fileName = `${prefix}-${getTimeStamp()}-${suffix}.json`;
      let changeFile = path.join(changePath, fileName);
      if (fs.existsSync(changeFile)) {
        const nextFileName = `${prefix}-${getTimeStamp()}-${suffix}-${Math.random()
          .toString(36)
          .substr(2, 9)}.json`;
        changeFile = path.join(changePath, nextFileName);
      }
      const change = changes[pkgName];
      fs.writeFileSync(changeFile, JSON.stringify(change, null, 2));
      changeFiles.push(changeFile);
    });
    stageAndCommit(changeFiles, 'Change files', cwd);
    console.log(`git committed these change files:
${changeFiles.map(f => ` - ${f}`).join('\n')}
`);
  }
}
