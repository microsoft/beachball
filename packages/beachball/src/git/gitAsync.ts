import execa from 'execa';
import { env } from '../env';

// cwd is required here
// stdio behavior is overridden
// reject is always false
export type GitAsyncOptions = Omit<
  execa.Options,
  'cwd' | 'all' | 'stdio' | 'stdout' | 'stderr' | 'stdin' | 'reject'
> & {
  cwd: string;
  verbose?: boolean;
};

export type GitAsyncResult = (
  | (Omit<execa.ExecaReturnValue<string>, 'failed'> & { success: true })
  | (Omit<execa.ExecaError<string>, 'failed'> & { success: false })
) & { errorMessage?: string };

/**
 * Run a git command asynchronously. If `verbose` is true, log the command before starting, and display
 * output on stdout (except in tests) *and* return it in the result. For tests with `verbose`, the output
 * will be logged all together to `console.log` when the command finishes (for easier mocking/capturing).
 *
 * (This utility should potentially be moved to `workspace-tools`, but it uses `execa` to capture
 * interleaved stdout/stderr, and `execa` is a large-ish dep not currently used there.)
 */
export async function gitAsync(args: string[], options: GitAsyncOptions): Promise<GitAsyncResult> {
  const { verbose, ...execaOpts } = options;
  const { shouldLog, maxBuffer } = getGitEnv(verbose);

  const gitCmd = `git ${args.join(' ')}`;

  shouldLog && console.log(`Running: ${gitCmd}`);

  const child = execa('git', args, {
    maxBuffer,
    ...execaOpts,
    stdio: 'pipe',
    all: true,
    reject: false,
  });

  if (shouldLog === 'live') {
    child.stdout?.pipe(process.stdout);
    child.stderr?.pipe(process.stderr);
  }

  const execaResult = await child;
  const result = { ...execaResult, success: !execaResult.failed } as GitAsyncResult;

  const log = result.success ? console.log : console.warn;

  if (shouldLog === 'end') {
    // do the jest logging all at once in a way that can be captured by mocks
    log(result.all);
  }

  let message = `${gitCmd} ${result.success ? 'completed successfully' : `failed (code ${result.exitCode})`}`;
  if (shouldLog) {
    log(message);
  } else {
    message += ` - output:\n${result.all}`;
  }

  if (!result.success) {
    result.errorMessage = message;
  }

  return result;
}

export function getGitEnv(verbose: boolean | undefined): {
  /**
   * If/when to log git commands and output:
   * - false: never (but return output in result)
   * - 'live': log command, and pipe output to stdout/stderr (if `verbose` or `process.env.GIT_DEBUG`, except in tests)
   * - 'end': log command, and log output at the end (for tests, if `verbose` or `process.env.GIT_DEBUG`)
   */
  shouldLog: false | 'live' | 'end';
  /** Max buffer for git operations, copied from workspace-tools implementation */
  maxBuffer: number;
} {
  return {
    shouldLog: verbose || env.workspaceToolsGitDebug ? (env.isJest ? 'end' : 'live') : false,
    maxBuffer: env.workspaceToolsGitMaxBuffer || 500 * 1024 * 1024,
  };
}
