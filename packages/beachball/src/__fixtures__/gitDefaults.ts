import { gitFailFast, type GitOptions } from 'workspace-tools';

export const defaultBranchName = 'master';
export const defaultRemoteName = 'origin';
export const defaultRemoteBranchName = 'origin/master';

/**
 * Configure the legacy default branch name to handle cases where
 * users have configured a different default branch name.
 * @param isRemoteRepo Whether this is the bare repo used as the remote
 */
export function setDefaultBranchName(cwd: string, isRemoteRepo?: boolean): void {
  if (isRemoteRepo) {
    // Change the name of the default branch on the repo used for the remote
    // (for clones, this is unnecessary and can cause problems)
    gitFailFast(['symbolic-ref', 'HEAD', 'refs/heads/' + defaultBranchName], { cwd });
  }
  // This needs to be configured for clones because other code may use it to find the default
  // comparison branch if none is specified
  gitFailFast(['config', 'init.defaultBranch', defaultBranchName], { cwd });
}

/**
 * Git logs are localized, but sometime's it's useful to be able to check for strings in them.
 * This function adds an environment variable that *should* force git to use English for its output.
 * (This should NOT be used to make full snapshots of git logs, or as the primary means of testing.
 * But it can be useful for allowing backup checks for absence of strings like "warning" or "fatal".)
 */
export function optsWithLang(opts: GitOptions): GitOptions {
  return { ...opts, env: { ...opts?.env, LANG: 'en_US.UTF-8' } };
}
