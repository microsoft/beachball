import path from 'path';
import { findProjectRoot } from 'workspace-tools';

/**
 * Get the folder containing beachball change files.
 */
export function getChangePath(cwd: string) {
  const root = findProjectRoot(cwd);

  if (root) {
    return path.join(root, 'change');
  }

  return null;
}
