import { ChangeFileInfo } from '../types/ChangeInfo';
import { getChangePath } from '../paths';
import { getBranchName, stage, commit } from 'workspace-tools';
import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Loops through the `changes` and writes out a list of change files
 * @returns List of changefile paths, mainly for testing purposes.
 */
export function writeChangeFiles(
  changes: {
    [pkgname: string]: ChangeFileInfo;
  },
  cwd: string,
  commitChangeFiles = true
): string[] {
  if (Object.keys(changes).length === 0) {
    return [];
  }

  const changePath = getChangePath(cwd);
  const branchName = getBranchName(cwd);
  if (changePath && !fs.existsSync(changePath)) {
    fs.mkdirpSync(changePath);
  }

  if (changes && branchName && changePath) {
    const changeFiles = Object.keys(changes).map(pkgName => {
      const change = changes[pkgName];

      const prefix = pkgName.replace(/[^a-zA-Z0-9@]/g, '-');
      const fileName = `${prefix}-${uuidv4()}.json`;
      let changeFile = path.join(changePath, fileName);

      fs.writeJSONSync(changeFile, change, { spaces: 2 });
      return changeFile;
    });

    stage(changeFiles, cwd);
    if (commitChangeFiles) {
      // only commit change files, ignore other staged files/changes
      const commitOptions = `${changeFiles.join(' ')}`;
      commit('Change files', cwd, [commitOptions]);
    }

    console.log(
      `git ${commitChangeFiles ? 'commited' : 'staged'} these change files: ${changeFiles
        .map(f => ` - ${f}`)
        .join('\n')}`
    );
    return changeFiles;
  }

  return [];
}
