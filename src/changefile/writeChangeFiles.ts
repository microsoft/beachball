import { ChangeFileInfo } from '../types/ChangeInfo';
import { defaultChangeFolder, getChangePath } from '../paths';
import { getBranchName, stage, commit } from 'workspace-tools';
import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Loops through the `changes` and writes out a list of change files
 * @returns List of changefile paths, mainly for testing purposes.
 */
export function writeChangeFiles(params: {
  changes: ChangeFileInfo[];
  cwd: string;
  /** default true */
  commitChangeFiles?: boolean;
  /** group all changes into one change file (default false) */
  groupChanges?: boolean;
  changeDir?: string;
}): string[] {
  const { changes, cwd, commitChangeFiles = true, groupChanges = false, changeDir = defaultChangeFolder } = params;
  const changePath = getChangePath(cwd, changeDir);
  const branchName = getBranchName(cwd);

  if (!(Object.keys(changes).length && branchName)) {
    return [];
  }

  if (!fs.existsSync(changePath)) {
    fs.mkdirpSync(changePath);
  }

  const getChangeFile = (prefix: string) => path.join(changePath, `${prefix}-${uuidv4()}.json`);
  let changeFiles: string[];

  if (groupChanges) {
    const changeFile = getChangeFile(changeDir);
    changeFiles = [changeFile];

    fs.writeFileSync(changeFile, JSON.stringify({ changes }, null, 2));
  } else {
    changeFiles = changes.map(change => {
      const changeFile = getChangeFile(change.packageName.replace(/[^a-zA-Z0-9@]/g, '-'));
      fs.writeJSONSync(changeFile, change, { spaces: 2 });
      return changeFile;
    });
  }

  stage(changeFiles, cwd);
  if (commitChangeFiles) {
    // only commit change files, ignore other staged files/changes
    const commitOptions = ['--only', path.join(changePath, '*.json')];
    commit('Change files', cwd, commitOptions);
  }

  console.log(
    `git ${commitChangeFiles ? 'committed' : 'staged'} these change files: ${changeFiles
      .map(f => `\n - ${f}`)
      .join('')}`
  );

  return changeFiles;
}
