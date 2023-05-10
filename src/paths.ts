import path from 'path';
import { findProjectRoot } from 'workspace-tools';

/** Relative path to the change files folder */
export const changeFolder = 'change';

/**
 * Get the absolute path to the folder containing beachball change files.
 */
export function getChangePath(cwd: string) {
  const root = findProjectRoot(cwd);
  return path.join(root, changeFolder);
}
