import { env } from '../env';
import { spawn, type SpawnOptions, type SpawnResult } from '../spawn';

// cwd is required here
// stdio behavior is overridden
type GitAsyncOptions = Omit<SpawnOptions, 'cwd' | 'stdio' | 'stdout' | 'stderr' | 'stdin'> & {
  cwd: string;
  verbose?: boolean;
};

/**
 * Run a git command asynchronously. If `verbose` is true, log the command before starting, and display
 * output on stdout. For tests with `verbose`, the output will be logged all together to `console.log`
 * when the command finishes (for easier mocking/capturing).
 */
export async function gitAsync(args: string[], options: GitAsyncOptions): Promise<SpawnResult> {
  const { verbose, ...spawnOpts } = options;
  const { shouldLog } = getGitEnv(verbose);

  const gitCmd = `git ${args.join(' ')}`;

  shouldLog && console.log(`Running: ${gitCmd}`);

  const result = await spawn('git', args, {
    ...spawnOpts,
    stdio: shouldLog === 'live' ? 'inherit' : 'pipe',
  });

  const log = result.success ? console.log : console.warn;

  if (shouldLog === 'end') {
    // do the jest logging all at once in a way that can be captured by mocks
    log(result.output);
  }

  let message = `Command ${result.success ? 'completed' : `failed (${result.timedOut ? 'timed out' : `code ${result.exitCode}`})`}: ${gitCmd}`;
  if (shouldLog) {
    log(message);
  } else if (result.output) {
    message += ` - output:\n${result.output}`;
  }

  if (!result.success) {
    result.message = message;
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
