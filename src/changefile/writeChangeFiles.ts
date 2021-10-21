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
export function writeChangeFiles({
  changes,
  cwd,
  commitChangeFiles = true,
  groupChanges = false,
}: {
  changes: ChangeFileInfo[];
  cwd: string;
  /** default true */
  commitChangeFiles?: boolean;
  /** group all changes into one change file (default false) */
  groupChanges?: boolean;
}): string[] {
  if (Object.keys(changes).length === 0) {
    return [];
  }

  const changePath = getChangePath(cwd);
  const branchName = getBranchName(cwd);
  if (changePath && !fs.existsSync(changePath)) {
    fs.mkdirpSync(changePath);
  }

  const prefix = 'change';
  if (groupChanges) {
    if (changes && branchName && changePath) {
      const fileName = `${prefix}-${uuidv4()}.json`;
      let changeFile = path.join(changePath, fileName);
      const changeFiles = [changeFile];

      fs.writeFileSync(changeFile, JSON.stringify({ changes }, null, 2));

      stage([changeFile], cwd);
      if (commitChangeFiles) {
        // only commit change files, ignore other staged files/changes
        const commitOptions = ['--only', path.join(changePath, '*.json')];
        commit('Change files', cwd, commitOptions);
      }

      console.log(
        `git ${commitChangeFiles ? 'committed' : 'staged'} these change files: ${changeFiles
          .map(f => ` - ${f}`)
          .join('\n')}`
      );
      return [changeFile];
    }
  }

  if (changes && branchName && changePath) {
    const changeFiles = changes.map(change => {
      const prefix = change.packageName.replace(/[^a-zA-Z0-9@]/g, '-');
      const fileName = `${prefix}-${uuidv4()}.json`;
      let changeFile = path.join(changePath, fileName);

      fs.writeJSONSync(changeFile, change, { spaces: 2 });
      return changeFile;
    });

    stage(changeFiles, cwd);
    if (commitChangeFiles) {
      // only commit change files, ignore other staged files/changes
      const commitOptions = ['--only', path.join(changePath, '*.json')];
      commit('Change files', cwd, commitOptions);
    }

    console.log(
      `git ${commitChangeFiles ? 'committed' : 'staged'} these change files: ${changeFiles
        .map(f => ` - ${f}`)
        .join('\n')}`
    );
    return changeFiles;
  }

  return [];
}
