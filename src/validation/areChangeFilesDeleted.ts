import { findProjectRoot, getChangePath } from '../paths';
import { BeachballOptions } from '../types/BeachballOptions';
import { getChangesBetweenRefs } from 'workspace-tools';

/**
 * Determines whether change files have been deleted.
 * Assumes `options.path` has already been validated.
 */
export function areChangeFilesDeleted(options: BeachballOptions): boolean {
  const { branch, path: cwd } = options;

  const root = findProjectRoot(cwd)!;
  const changePath = getChangePath(cwd);

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
    const changeFiles = changeFilesDeletedSinceRef.map(file => `- ${file}`).join('\n');
    const log = options.disallowDeletedChangeFiles ? console.error : console.log;
    log(`The following change files were deleted:\n${changeFiles}\n`);
  }

  return changeFilesDeleted;
}
