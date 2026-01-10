import { env } from '../env';
import { spawn, type SpawnErrorResult, type SpawnOptions, type SpawnSuccessResult } from '../process/spawn';

// stdio behavior is overridden
export type GitAsyncOptions = Omit<SpawnOptions, 'stdio' | 'stdout' | 'stderr' | 'stdin'> & {
  verbose?: boolean;
};

export type GitAsyncResult = SpawnSuccessResult | (SpawnErrorResult & { errorMessage?: string });

/**
 * Run a git command asynchronously. If `verbose` is true, log the command before starting, and display
 * output on stdout (except in tests) *and* return it in the result. For tests with `verbose`, the output
 * will be logged all together to `console.log` when the command finishes (for easier mocking/capturing).
 *
 * (This utility should potentially be moved to `workspace-tools`, but it uses `execa` to capture
 * interleaved stdout/stderr, and `execa` is a large-ish dep not currently used there.)
 */
export async function gitAsync(args: string[], options: GitAsyncOptions): Promise<GitAsyncResult> {
  const { verbose, ...spawnOpts } = options;

  const { shouldLog } = getGitEnv(verbose);

  const gitCmd = `git ${args.join(' ')}`;

  shouldLog && console.log(`Running: ${gitCmd}`);

  const result: GitAsyncResult = await spawn('git', args, {
    ...spawnOpts,
    stdioPipeAndInherit: shouldLog === 'live',
  });

  const log = result.success ? console.log : console.warn;

  if (shouldLog === 'end') {
    // do the jest logging all at once in a way that can be captured by mocks
    log(result.output);
  }

  let message = `${gitCmd} ${result.success ? 'completed successfully' : `failed (code ${result.exitCode})`}`;
  if (shouldLog) {
    log(message);
  } else {
    message += ` - output:\n${result.output}`;
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
} {
  return {
    shouldLog: verbose || env.workspaceToolsGitDebug ? (env.isJest ? 'end' : 'live') : false,
  };
}
