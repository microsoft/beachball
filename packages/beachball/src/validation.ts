import { findGitRoot } from './paths';
import { getChangedPackages } from './getChangedPackages';
import { git } from './git';
import { getAllPackages } from './monorepo';

export function isChangeFileNeeded(branch: string, cwd: string, fetch: boolean) {
  console.log(`Checking for changes against "${branch}"`);

  const changedPackages = getChangedPackages(branch, cwd, fetch);

  if (changedPackages.length > 0) {
    console.log(`Found changes in the following packages: [${changedPackages.join(', ')}]`);
  }

  return changedPackages.length > 0;
}

export function isGitAvailable(cwd: string) {
  const result = git(['--version']);
  const gitRoot = findGitRoot(cwd);
  return result.success && gitRoot;
}

export function isValidPackageName(pkg: string, cwd: string) {
  const packages = getAllPackages(cwd);
  return packages.includes(pkg);
}

export function isValidChangeType(changeType: string) {
  return ['patch', 'major', 'minor', 'prerelease'].includes(changeType);
}
