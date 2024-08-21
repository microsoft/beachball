import path from 'path';
import { findProjectRoot } from 'workspace-tools';

/** Relative path to the change files folder */
export const defaultChangeFolder = 'change';

/**
 * Get the absolute path to the folder containing beachball change files.
 */
export function getChangePath(cwd: string, changdir?: string): string {
  const root = findProjectRoot(cwd);
  return path.join(root, changdir ?? defaultChangeFolder);
}
