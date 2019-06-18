import { findGitRoot } from './paths';
import { getChangedPackages } from './getChangedPackages';
import { git } from './git';

export function isChangeFileNeeded(branch: string, cwd: string) {
  console.log(`Checking for changes against "${branch}"`);

  const changedPackages = getChangedPackages(branch, cwd);
  return changedPackages.length > 0;
}

export function isGitAvailable(cwd: string) {
  const result = git(['--version']);
  const gitRoot = findGitRoot(cwd);
  return result.success && gitRoot;
}

export function isValidTargetBranch(branch?: string) {
  if (branch) {
    return branch.indexOf('/') > -1;
  }

  return false;
}
