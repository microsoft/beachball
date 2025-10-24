import type { ChangeFileInfo } from '../types/ChangeInfo';
import type { ChangeType } from '../types/ChangeInfo';
import { getChangePath } from '../paths';
import { getBranchName, stage } from 'workspace-tools';
import { gitAsync } from '../git/gitAsync';
import fs from 'fs-extra';
import path from 'path';
import type { BeachballOptions } from '../types/BeachballOptions';

/**
 * Updates the most recently committed change file with new changes and creates a fixup commit.
 * Searches through recent commits to find the most recent commit that introduced change files.
 * @param changes - The new changes to add to the existing change file
 * @param options - Beachball options
 * @returns The path to the updated change file, or null if no suitable change file was found
 */
export async function writeChangeFilesFixup(
  changes: ChangeFileInfo[],
  options: Pick<BeachballOptions, 'path' | 'groupChanges' | 'changeDir' | 'commit'>
): Promise<string | null> {
  const { path: cwd, groupChanges } = options;
  const changePath = getChangePath(options);
  const branchName = getBranchName(cwd);

  if (!(Object.keys(changes).length && branchName)) {
    return null;
  }

  if (!fs.existsSync(changePath)) {
    console.warn('No change directory found. Cannot use fixup mode without existing change files.');
    return null;
  }

  // Find the most recent commit that introduced change files
  const commitAndFile = await findMostRecentChangeFileCommit(cwd, changePath);

  if (!commitAndFile) {
    console.warn('No recent commits found that introduced change files. Cannot use fixup mode.');
    return null;
  }

  const { commitHash, changeFileName } = commitAndFile;
  const changeFilePath = path.join(changePath, changeFileName);

  console.log(`Updating change file from commit ${commitHash}: ${changeFileName}`);

  // Read existing change file
  let existingChangeInfo: ChangeFileInfo | { changes: ChangeFileInfo[] };
  try {
    existingChangeInfo = fs.readJSONSync(changeFilePath);
  } catch (e) {
    console.error(`Error reading existing change file ${changeFilePath}: ${e}`);
    return null;
  }

  // Update the change file with new changes
  if (groupChanges) {
    // For grouped changes, add to the existing changes array
    const groupedChanges = existingChangeInfo as { changes: ChangeFileInfo[] };
    groupedChanges.changes.push(...changes);
    fs.writeFileSync(changeFilePath, JSON.stringify(groupedChanges, null, 2));
  } else {
    // For individual change files, merge the new change with the existing one
    // We assume there's only one new change for fixup mode with individual files
    if (changes.length > 1) {
      console.warn(
        'Fixup mode with individual change files only supports updating one package at a time. Using the first change.'
      );
    }
    const newChange = changes[0];
    const existingChange = existingChangeInfo as ChangeFileInfo;

    // Merge comments and other properties
    const mergedChange: ChangeFileInfo = {
      ...existingChange,
      ...newChange,
      // Override with merged comment and higher change type
      comment: existingChange.comment ? `${existingChange.comment}\n\n${newChange.comment}` : newChange.comment,
      type: getHigherChangeType(existingChange.type, newChange.type),
      // But preserve the original package name
      packageName: existingChange.packageName,
    };

    fs.writeJSONSync(changeFilePath, mergedChange, { spaces: 2 });
  }

  // Stage the updated change file
  stage([changeFilePath], cwd);

  // Create a fixup commit using the original commit hash
  console.log(`Original change file was added in commit: ${commitHash}`);

  // Create a fixup commit
  const commitResult = await gitAsync(['commit', '--fixup', commitHash], { cwd, verbose: true });

  if (!commitResult.success) {
    console.error(`Failed to create fixup commit: ${commitResult.errorMessage}`);
    return null;
  }

  console.log(`Created fixup commit for ${commitHash}`);
  console.log(`Updated change file: ${changeFilePath}`);

  return changeFilePath;
}

const MAX_COMMITS = 100;

/**
 * Finds the most recent commit that introduced change files by searching through
 * the current branch's commits from newest to oldest.
 * @param cwd - Working directory
 * @param changePath - Path to the change directory
 * @returns Object with commit hash and change file name, or null if none found
 */
async function findMostRecentChangeFileCommit(
  cwd: string,
  changePath: string
): Promise<{ commitHash: string; changeFileName: string } | null> {
  const relativeChangePath = path.relative(cwd, changePath);

  // Get the fork point (merge base with main/master branch)
  const forkPointResult = await findForkPoint(cwd);
  if (!forkPointResult) {
    console.warn('Unable to determine fork-point for current branch');
    return null;
  }

  // Get commits on the current branch, limited to MAX_COMMITS
  const logResult = await gitAsync(
    ['log', '--oneline', '--format=%H', `-n`, MAX_COMMITS.toString(), `${forkPointResult}..HEAD`],
    { cwd }
  );
  if (!logResult.success) {
    console.warn('Failed to get git log for finding recent change file commits');
    return null;
  }

  const commits = logResult.stdout
    .trim()
    .split('\n')
    .filter(line => line.trim());

  // Search through commits from newest to oldest
  for (const commitHash of commits) {
    // Check what files were added in this commit (compare with parent)
    const diffResult = await gitAsync(
      [
        'diff-tree',
        '--no-commit-id',
        '--name-status',
        '--diff-filter=A', // Only look for added files
        '-r', // Recursive to show files inside directories
        commitHash,
      ],
      { cwd }
    );

    if (!diffResult.success) {
      continue;
    }

    // Look for added change files
    const addedChangeFiles: string[] = [];
    const lines = diffResult.stdout
      .trim()
      .split('\n')
      .filter(line => line.trim());

    for (const line of lines) {
      // Handle both formats: "A\tfilepath" and "filepath" (when only added files are shown)
      const parts = line.split('\t');
      const filePath = parts.length > 1 ? parts[1] : line;

      if (filePath) {
        // Normalize paths for comparison
        const normalizedPath = filePath.replace(/\\/g, '/');
        const normalizedChangePath = relativeChangePath.replace(/\\/g, '/');

        if (normalizedPath.startsWith(normalizedChangePath) && normalizedPath.endsWith('.json')) {
          const fileName = path.basename(normalizedPath);
          addedChangeFiles.push(fileName);
        }
      }
    }

    if (addedChangeFiles.length > 0) {
      // Sort alphabetically and take the first one
      addedChangeFiles.sort();
      const selectedFile = addedChangeFiles[0];

      // Verify the file still exists
      const fullPath = path.join(changePath, selectedFile);
      if (fs.existsSync(fullPath)) {
        console.log(`Found change file commit: ${commitHash} added ${selectedFile}`);
        return { commitHash, changeFileName: selectedFile };
      }
    }
  }

  return null;
}

/**
 * Finds the fork point (merge base) with the main branch.
 * @param cwd - Working directory
 * @returns The commit hash of the fork point, or null if not found
 */
async function findForkPoint(cwd: string): Promise<string | null> {
  // Try common main branch names
  const mainBranches = ['origin/main', 'origin/master', 'main', 'master'];

  for (const mainBranch of mainBranches) {
    const result = await gitAsync(['merge-base', 'HEAD', mainBranch], { cwd });
    if (result.success) {
      return result.stdout.trim();
    }
  }

  return null;
}

/**
 * Determines which change type has higher severity for merging changes.
 * Order: premajor/major > preminor/minor > prepatch/patch > prerelease > none
 */
function getHigherChangeType(type1: ChangeType, type2: ChangeType): ChangeType {
  const changeTypeOrder: Record<ChangeType, number> = {
    premajor: 7,
    major: 6,
    preminor: 5,
    minor: 4,
    prepatch: 3,
    patch: 2,
    prerelease: 1,
    none: 0,
  };
  const order1 = changeTypeOrder[type1] ?? 0;
  const order2 = changeTypeOrder[type2] ?? 0;

  return order1 >= order2 ? type1 : type2;
}
