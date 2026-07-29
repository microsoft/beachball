import type { SpawnFailureResult, SpawnSuccessResult } from '../spawn';

/**
 * Make a generic spawn success result. `output` is used as `stdout` by default.
 */
export function mockSpawnSuccess(options?: Partial<Omit<SpawnSuccessResult, 'success'>>): SpawnSuccessResult {
  return {
    success: true,
    stdout: options?.output ?? '',
    stderr: '',
    output: '',
    command: '',
    durationMs: 0,
    ...options,
  };
}

/**
 * Fake version of `nano-spawn`'s `SubprocessError` for testing.
 *
 * NOTE: not a realistic implementation of all properties!
 */
export class MockSubprocessError extends Error implements SpawnFailureResult {
  public name = 'MockSubprocessError';
  public success = false as const;
  public stdout = '';
  public stderr = '';
  public output = '';
  public command = '';
  public durationMs = 0;
  public exitCode: number | undefined;
  public isCanceled = false;
  public timedOut = false;

  /**
   * `output` is used as `stderr` by default. If `timedOut` is true, `exitCode` will be undefined.
   */
  public constructor(options?: Partial<Pick<SpawnFailureResult, 'output' | 'timedOut'>> & ErrorOptions) {
    const { output, timedOut, ...rest } = options ?? {};
    super('Command failed', rest);
    this.output = output ?? '';
    this.stderr = this.output;
    this.timedOut = !!timedOut;
    this.exitCode = this.timedOut ? undefined : 1;
  }
}
