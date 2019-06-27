import { findGitRoot } from './paths';
import { getChangedPackages } from './getChangedPackages';
import { git } from './git';
import { getAllPackages } from './monorepo';

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

export function isValidPackageName(pkg: string, cwd: string) {
  const packages = getAllPackages(cwd);
  return packages.includes(pkg);
}
