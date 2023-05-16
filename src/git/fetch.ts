import { git, GitProcessOutput } from 'workspace-tools';
import { getGitEnv } from './gitAsync';

type GitFetchParams = {
  cwd: string;
  /** Remote to fetch from. If not specified, fetches all remotes. */
  remote?: string;
  /** Branch to fetch. This will be ignored if `remote` is not also specified. */
  branch?: string;
  /** Set depth to this number of commits (mutually exclusive with `deepen` and `unshallow`) */
  depth?: number;
  /** Deepen a shallow clone by this number of commits (mutually exclusive with `depth` and `unshallow`) */
  deepen?: number;
  /** Convert this from a shallow clone to a full clone (mutually exclusive with `depth` and `deepen`) */
  unshallow?: true;
  verbose?: boolean;
};

/**
 * Wrapper for `git fetch`. If `verbose` is true, log the command before starting, and display output
 * on stdout (except in tests). In tests with `verbose`, the output will be logged all together to
 * `console.log` when the command finishes (for easier mocking/capturing).
 */
export function gitFetch(params: GitFetchParams): GitProcessOutput & { errorMessage?: string } {
  const { remote, branch, depth, deepen, unshallow, cwd, verbose } = params;
  const { shouldLog } = getGitEnv(verbose);

  if ([depth, deepen, unshallow].filter(v => v !== undefined).length > 1) {
    throw new Error('"depth", "deepen", and "unshallow" are mutually exclusive');
  }

  const extraArgs = depth ? [`--depth=${depth}`] : deepen ? [`--deepen=${deepen}`] : unshallow ? ['--unshallow'] : [];

  let description = remote
    ? `Fetching ${branch ? `branch "${branch}" from ` : ''}remote "${remote}"`
    : 'Fetching all remotes';

  if (extraArgs.length) {
    description += ` (with ${extraArgs.join(' ')})`;
  }

  shouldLog && console.log(description + '...');

  const result: ReturnType<typeof gitFetch> = git(
    [
      'fetch',
      ...extraArgs,
      // If the remote is unknown, don't specify the branch (fetching a branch without a remote is invalid)
      ...(remote && branch ? [remote, branch] : remote ? [remote] : []),
    ],
    { cwd, stdio: shouldLog === 'live' ? 'inherit' : 'pipe' }
  );

  const log = result.success ? console.log : console.warn;

  // do the jest logging all at once in a way that can be captured by mocks (jest can't mock process.stdout/err)
  if (shouldLog === 'end') {
    result.stdout && console.log(result.stdout);
    result.stderr && log(result.stderr);
  }

  let message = `${description} ${result.success ? 'completed successfully' : `failed (code ${result.status})`}`;
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
