import { findGitRoot } from './paths';
import { getChangedPackages } from './getChangedPackages';
import { git } from './git';

export function isChangeFileNeeded(branch: string, cwd: string) {
  const changedPackages = getChangedPackages(branch, cwd);
  return changedPackages.length > 0;
}

export function isGitAvailable(cwd: string) {
  const result = git(['--version']);
  const gitRoot = findGitRoot(cwd);
  return result.success && gitRoot;
}
