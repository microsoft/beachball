import { git } from 'workspace-tools';

export const defaultBranchName = 'master';
export const defaultRemoteBranchName = 'origin/' + defaultBranchName;

export function gitInitWithDefaultBranchName(cwd: string) {
  git(['init', '--bare'], { cwd });

  setDefaultBranchName(cwd);
}

/**
 * Configure the legacy default branch name to handle cases where
 * users have configured a different default branch name.
 */
export function setDefaultBranchName(cwd: string) {
  git(['symbolic-ref', 'HEAD', 'refs/heads/' + defaultBranchName], { cwd });
  git(['config', 'init.defaultBranch', defaultBranchName], { cwd });
}
