import { findProjectRoot, getChangePath } from '../paths';
import { BeachballOptions } from '../types/BeachballOptions';
import { getChangesBetweenRefs } from 'workspace-tools';

export function areChangeFilesDeleted(options: BeachballOptions): boolean {
  const { branch, path: cwd } = options;

  const root = findProjectRoot(cwd);
  if (!root) {
    console.error('Failed to find the project root');
    process.exit(1);
  }

  const changePath = getChangePath(cwd);
  if (!changePath) {
    console.error('Failed to find a folder with change files');
    process.exit(1);
  }

  console.log(`Checking for deleted change files against "${branch}"`);
  const changeFilesDeletedSinceRef = getChangesBetweenRefs(
    branch,
    'HEAD',
    [
      '--diff-filter=D', // showing only deleted files from the diff.
    ],
    `${changePath}/*.json`,
    root
  );

  // if this value is undefined, git has failed to execute the command above.
  if (!changeFilesDeletedSinceRef) {
    process.exit(1);
  }

  const changeFilesDeleted = changeFilesDeletedSinceRef.length > 0;

  if (changeFilesDeleted) {
    const changeFiles = changeFilesDeletedSinceRef.map(file => `- ${file}`);
    const errorMessage = 'The following change files were deleted:';

    console.error(`${errorMessage}\n${changeFiles.join('\n')}\n`);
  }

  return changeFilesDeleted;
}
