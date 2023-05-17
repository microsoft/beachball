import { getChangePath } from '../paths';
import { BeachballOptions } from '../types/BeachballOptions';
import { getChangesBetweenRefs, findProjectRoot } from 'workspace-tools';

export function areChangeFilesDeleted(options: BeachballOptions): boolean {
  const { branch, path: cwd } = options;

  const root = findProjectRoot(cwd);
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

  if (changeFilesDeletedSinceRef.length) {
    const changeFiles = changeFilesDeletedSinceRef.map(file => `- ${file}`);
    console.error(`ERROR: The following change files were deleted:\n${changeFiles.join('\n')}\n`);
    return true;
  }

  return false;
}
