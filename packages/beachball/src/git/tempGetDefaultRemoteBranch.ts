// temporary copy of packages/workspace-tools/src/git/getDefaultRemoteBranch.ts
// to allow continued testing of ESRP before package quarantine time passes
import { getDefaultRemote, type GetDefaultRemoteOptions } from 'workspace-tools/lib/git/getDefaultRemote';
import { git } from 'workspace-tools/lib/git/git';
import { getDefaultBranch } from 'workspace-tools/lib/git/gitUtilities';
import { parseRemoteBranchPlusRemotes } from 'workspace-tools/lib/git/parseRemoteBranch';

export type ParsedRemoteBranch = {
  /**
   * Remote name, e.g. `origin`.
   * May be an empty string if the original branch reference didn't include a remote.
   */
  remote: string;
  /** Branch name without remote, e.g. `main`. This is always set. */
  remoteBranch: string;
};

export type RemoteBranch = Pick<ParsedRemoteBranch, 'remoteBranch'> & {
  /** Remote name, e.g. `origin`. */
  remote: string;
};

export type GetDefaultRemoteBranchOptions = GetDefaultRemoteOptions & {
  /**
   * Name of branch to use, **without** a remote prefix. If you want to resolve a branch
   * that may already include a remote prefix, use {@link resolveRemoteAndBranch}.
   *
   * If undefined, uses the default branch name (falling back to `master`).
   */
  branch?: string;
};

/**
 * Like {@link getDefaultRemoteBranch} but it returns an object.
 *
 * @returns A branch reference like `{ remote: "upstream", branch: "master" }` or `{ remote: "origin", branch: "main" }`.
 */
function getDefaultRemoteAndBranch(options: GetDefaultRemoteBranchOptions): RemoteBranch {
  const { cwd, branch } = options;

  const defaultRemote = getDefaultRemote(options);

  if (branch) {
    // For this specific function, `branch` has no remote prefix
    return { remote: defaultRemote, remoteBranch: branch };
  }

  let remoteDefaultBranch: string | undefined;

  // Get the default branch name from the default remote.
  // ls-remote is a plumbing command with stable, locale-independent output.
  // Output format: "ref: refs/heads/main\tHEAD\n<hash>\tHEAD"
  const lsRemoteCmd = ['ls-remote', '--symref', defaultRemote, 'HEAD'];
  const lsRemote = git(lsRemoteCmd, {
    cwd,
    throwOnError: options.strict,
    description: `Fetching default branch info from remote "${defaultRemote}"`,
  });
  if (lsRemote.success) {
    const refRegex = /^ref: refs\/heads\/(.*?)\t/;
    const symRefLine = lsRemote.stdout.split('\n').find(line => refRegex.test(line));
    remoteDefaultBranch = symRefLine && symRefLine.match(refRegex)?.[1];

    if (!remoteDefaultBranch && options.strict) {
      throw new Error(
        `Could not parse default branch from \`git ${lsRemoteCmd.join(' ')}\` output:\n${lsRemote.stdout}`
      );
    }
  }

  // If no default branch found from the remote, fall back to the local git config or "master"
  // (this can't use throwOnError in case the key isn't set)
  remoteDefaultBranch ||= getDefaultBranch({ cwd });

  return { remote: defaultRemote, remoteBranch: remoteDefaultBranch };
}

/**
 * Resolve a user-provided branch (possibly with a remote) to a fully-qualified remote branch.
 * First tries the less-expensive {@link parseRemoteBranchPlusRemotes} (compares with remote names
 * read from `git config`) to see if there's an explicit remote in the branch name, then tries
 * {@link getDefaultRemoteBranch}.
 *
 * If `options.strict` is true, throws in the same cases as {@link parseRemoteBranch},
 * {@link getDefaultRemoteBranch}, {@link getDefaultRemote}, or {@link getRemotes}.
 *
 * @returns A fully-qualified target remote branch reference (e.g. `{ remote: "origin", branch: "main" }`)
 */
export function resolveRemoteAndBranch(
  options: Omit<GetDefaultRemoteBranchOptions, 'branch' | 'remotes'> & {
    /** Branch which might include a remote prefix */
    branch: string | undefined;
  }
): RemoteBranch {
  const { branch } = options;

  let parsed: ReturnType<typeof parseRemoteBranchPlusRemotes> | undefined;
  if (branch) {
    // A branch is provided, so see if it includes a remote name.
    // The result is saved so the fetched list of remotes can be reused.
    parsed = parseRemoteBranchPlusRemotes({ ...options, branch });
    if (parsed.remote) {
      // have to extract these to avoid returning `remotes`
      return { remote: parsed.remote, remoteBranch: parsed.remoteBranch };
    }
  }

  // No branch provided, or the provided branch didn't include a remote.
  // Get the default remote and possibly default branch.
  return getDefaultRemoteAndBranch({ ...options, remotes: parsed?.remotes });
}
