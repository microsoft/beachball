import { bulletedList } from '../logging/bulletedList';
import { getChangePath } from '../paths';
import type { BeachballOptions } from '../types/BeachballOptions';
import { getChangesBetweenRefs } from 'workspace-tools';

export function areChangeFilesDeleted(options: Pick<BeachballOptions, 'branch' | 'path' | 'changeDir'>): boolean {
  const { branch, path: cwd } = options;

  const changePath = getChangePath(options);

  console.log(`Checking for deleted change files against "${branch}"`);
  const changeFilesDeletedSinceRef = getChangesBetweenRefs(
    branch,
    'HEAD',
    [
      '--diff-filter=D', // showing only deleted files from the diff.
    ],
    `${changePath}/*.json`,
    cwd
  );

  if (changeFilesDeletedSinceRef.length) {
    const changeFiles = changeFilesDeletedSinceRef.map(file => `- ${file}`);
    console.error(`ERROR: The following change files were deleted:\n${bulletedList(changeFiles)}\n`);
    return true;
  }

  return false;
}
