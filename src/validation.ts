import { getChangePath, findGitRoot } from './paths';
import fs from 'fs';
import path from 'path';
import { getChangedPackages } from './getChangedPackages';
import { git } from './git';

export function isChangeFileNeeded(cwd?: string) {
  const changedPackages = getChangedPackages(cwd);
  return changedPackages.length > 0;
}

export function isGitAvailable(cwd?: string) {
  const result = git(['--version']);
  const gitRoot = findGitRoot(cwd);
  return result.success && gitRoot;
}
