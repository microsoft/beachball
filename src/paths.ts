import path from 'path';
import { findProjectRoot } from 'workspace-tools';
import type { BeachballOptions } from './types/BeachballOptions';

/**
 * Get the absolute path to the folder containing beachball change files.
 */
export function getChangePath(options: Pick<BeachballOptions, 'path' | 'changeDir'>): string {
  const root = findProjectRoot(options.path);
  return path.join(root, options.changeDir);
}
