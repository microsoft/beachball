import type { Options, Result, SubprocessError } from 'nano-spawn';

export type SpawnOptions = Options;
export type SpawnSuccessResult = Result & { success: true };
export type SpawnFailureResult = SubprocessError & { success: false; timedOut?: boolean };
/** `nano-spawn` results with added convenience properties like `execa`. */
export type SpawnResult = SpawnSuccessResult | SpawnFailureResult;

let nanoSpawn: typeof import('nano-spawn').default | undefined;

/**
 * Wrapper for `nano-spawn` implementing some `execa`-like behaviors.
 * Instead of rejecting on failure, it returns a result with `success: false` and the error details.
 * Similar to `execa`, internally `nano-spawn` merges the `env` option with `process.env`.
 *
 * Note that if you need the subprocess object, you can't use this wrapper since it must await the
 * module import first.
 */
export async function spawn(bin: string, args: string[], options?: SpawnOptions): Promise<SpawnResult> {
  // The delayed async import can be removed once upgraded to Node 24 (there are jest + CJS issues
  // with 22) or if the package is converted fully to ESM.
  nanoSpawn ??= (await import('nano-spawn')).default;

  if (options?.timeout && options?.signal) {
    throw new Error('Cannot specify both timeout and signal in spawn options');
  }

  // Use a signal to precisely track whether the process was aborted due to timeout
  const timeoutSignal = options?.timeout ? AbortSignal.timeout(options.timeout) : options?.signal;
  try {
    const result = await nanoSpawn(bin, args, { signal: timeoutSignal, ...options, timeout: undefined });
    return { ...result, success: true };
  } catch (e) {
    const err = e as SpawnFailureResult;
    err.success = false;
    // The only case where timedOut is already set is by MockSubprocessError
    err.timedOut ??= timeoutSignal?.aborted;
    return err;
  }
}
