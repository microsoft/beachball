import { git, type GitProcessOutput } from 'workspace-tools';
import { getGitEnv } from './gitAsync';
import { getGitAuthEnv } from './getGitAuthEnv';

export type GitFetchParams = {
  cwd: string;
  /**
   * Remote to fetch from. The config reading logic ensures this is a non-empty string (with the
   * fallback of `origin` if no remotes were detected, though in that case fetching will likely fail).
   */
  remote: string;
  /**
   * Branch(es) to fetch, **without** a remote prefix. Each will be converted to a full refspec for fetching:
   * e.g. `branch: 'main', remote: 'origin'` will be converted to `+refs/heads/main:refs/remotes/origin/main`.
   * Pass an array to fetch multiple branches in a single git invocation, which lets a single
   * `--deepen` or `--unshallow` apply to all of them (saves network round-trips when both HEAD
   * and the target branch need deepening).
   */
  branch: string | string[];
  /** Set depth to this number of commits (mutually exclusive with `deepen` and `unshallow`) */
  depth?: number;
  /** Deepen a shallow clone by this number of commits (mutually exclusive with `depth` and `unshallow`) */
  deepen?: number;
  /** Convert this from a shallow clone to a full clone (mutually exclusive with `depth` and `deepen`) */
  unshallow?: true;
  verbose: boolean | undefined;
  /**
   * Token to authenticate the fetch (usually from `BEACHBALL_GIT_TOKEN`). When set, an auth header is
   * injected into the git process env, along with overrides of conflicting `.extraheader` configs.
   * See {@link getGitAuthEnv} for details.
   */
  gitToken: string | undefined;
  /** Environment override for testing. */
  env?: NodeJS.ProcessEnv;
};

/**
 * Wrapper for `git fetch`. If `verbose` is true, log the command before starting, and display output
 * on stdout (except in tests). In tests with `verbose`, the output will be logged all together to
 * `console.log` when the command finishes (for easier mocking/capturing).
 *
 * This converts `remote` and `branch` into a fully qualified refspec, so it doesn't matter if
 * the remote branch is tracked or not in the local repository.
 */
export function gitFetch(params: GitFetchParams): GitProcessOutput & { errorMessage?: string } {
  const { remote, depth, deepen, unshallow, cwd, verbose, gitToken, env = process.env } = params;
  const branches = Array.isArray(params.branch) ? params.branch : [params.branch];
  const { shouldLog } = getGitEnv(verbose);

  // Get auth config env if relevant.
  // Do NOT log this value since it contains the encoded token.
  const authEnv = getGitAuthEnv({ gitToken, path: cwd, remote, env, operation: 'fetch' });

  if ([depth, deepen, unshallow].filter(v => v !== undefined).length > 1) {
    throw new Error('"depth", "deepen", and "unshallow" are mutually exclusive');
  }

  const extraArgs = depth ? [`--depth=${depth}`] : deepen ? [`--deepen=${deepen}`] : unshallow ? ['--unshallow'] : [];

  // Be specific with each ref being fetched, so we don't have to worry about tracking configs.
  // In git fetch <remote> +<src>:<dst>...
  // - The + means allow non-fast-forward updates (in case the remote was force pushed).
  // - <src> refs/heads/${branch} is resolved against the remote's advertised refs. The fully
  //   qualified ref is unambiguous, whereas bare branch names can be silently misresolved,
  //   causing git to treat the ref as absent and delete the local tracking ref.
  // - <dst> refs/remotes/${remote}/${branch} is resolved locally and only moves the tracking ref
  //   for the remote branch, not the local refs/heads/${branch} or its tracking config.
  const resolvedRefspecs = branches.map(b => `+refs/heads/${b}:refs/remotes/${remote}/${b}`);

  const branchLabel =
    branches.length > 1 ? `branches ${branches.map(b => `"${b}"`).join(', ')}` : `branch "${branches[0]}"`;
  const shortDescription = `Fetching ${branchLabel} from remote "${remote}"`;

  let description = shortDescription;
  resolvedRefspecs.length && (description += ` (${resolvedRefspecs.join(' ')})`);
  extraArgs.length && (description += ` (with ${extraArgs.join(' ')})`);
  shouldLog && console.log(description + '...');

  const result: ReturnType<typeof gitFetch> = git(['fetch', '--no-tags', ...extraArgs, remote, ...resolvedRefspecs], {
    cwd,
    stdio: shouldLog === 'live' ? 'inherit' : 'pipe',
    // Include the original env since git() uses spawnSync which doesn't inherit process.env
    ...(authEnv && { env: { ...env, ...authEnv } }),
  });

  const log = result.success ? console.log : console.warn;

  // do the jest logging all at once in a way that can be captured by mocks (jest can't mock process.stdout/err)
  if (shouldLog === 'end') {
    result.stdout && console.log(result.stdout);
    result.stderr && log(result.stderr);
  }

  let message = `${shortDescription} ${result.success ? 'completed successfully' : `failed (code ${result.status})`}`;
  if (shouldLog) {
    log(message);
    message += ' - see above for details';
  } else if (result.stdout && result.stderr) {
    message += `\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`;
  } else if (result.stdout || result.stderr) {
    message += ` - output:\n${result.stdout || result.stderr}`;
  }

  if (!result.success) {
    result.errorMessage = message;
  }

  return result;
}
