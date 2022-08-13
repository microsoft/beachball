import { gitFailFast } from 'workspace-tools';

export const defaultBranchName = 'master';
export const defaultRemoteName = 'origin';
export const defaultRemoteBranchName = 'origin/master';

/**
 * Configure the legacy default branch name to handle cases where
 * users have configured a different default branch name.
 */
export function setDefaultBranchName(cwd: string) {
  gitFailFast(['symbolic-ref', 'HEAD', 'refs/heads/' + defaultBranchName], { cwd });
  gitFailFast(['config', 'init.defaultBranch', defaultBranchName], { cwd });
}
