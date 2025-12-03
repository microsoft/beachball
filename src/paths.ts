import path from 'path';
import type { BeachballOptions } from './types/BeachballOptions';

/**
 * Get the absolute path to the folder containing beachball change files.
 */
export function getChangePath(options: Pick<BeachballOptions, 'path' | 'changeDir'>): string {
  return path.join(options.path, options.changeDir);
}
