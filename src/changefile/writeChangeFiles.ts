import type { ChangeFileInfo } from '../types/ChangeInfo';
import { getChangePath } from '../paths';
import { getBranchName, stage, commit } from 'workspace-tools';
import crypto from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import type { BeachballOptions } from '../types/BeachballOptions';

/**
 * Loops through the `changes` and writes out a list of change files
 * @returns List of changefile paths, mainly for testing purposes.
 */
export function writeChangeFiles(
  changes: ChangeFileInfo[],
  options: Pick<BeachballOptions, 'path' | 'groupChanges' | 'changeDir' | 'commit'>
): string[] {
  const { path: cwd, groupChanges, commit: commitChangeFiles } = options;
  const changePath = getChangePath(options);
  const branchName = getBranchName({ cwd });

  if (!(Object.keys(changes).length && branchName)) {
    return [];
  }

  if (!fs.existsSync(changePath)) {
    fs.mkdirpSync(changePath);
  }

  const getChangeFile = (prefix: string) => path.join(changePath, `${prefix}-${crypto.randomUUID()}.json`);
  let changeFiles: string[];

  if (groupChanges) {
    // use a generic file prefix when grouping changes
    const changeFile = getChangeFile('change');
    changeFiles = [changeFile];

    fs.writeFileSync(changeFile, JSON.stringify({ changes }, null, 2));
  } else {
    changeFiles = changes.map(change => {
      const changeFile = getChangeFile(change.packageName.replace(/[^\w@]/g, '-'));
      fs.writeJSONSync(changeFile, change, { spaces: 2 });
      return changeFile;
    });
  }

  stage({ patterns: changeFiles, cwd });
  if (commitChangeFiles) {
    // only commit change files, ignore other staged files/changes
    const commitOptions = ['--only', path.join(changePath, '*.json')];
    commit({ message: 'Change files', cwd, options: commitOptions });
  }

  console.log(
    `git ${commitChangeFiles ? 'committed' : 'staged'} these change files: ${changeFiles
      .map(f => `\n - ${f}`)
      .join('')}`
  );

  return changeFiles;
}
