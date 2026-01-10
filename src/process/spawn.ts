import type * as nanoSpawnType from 'nano-spawn' with {
  'resolution-mode': 'import',
};

let _nanoSpawn: typeof nanoSpawnType.default | undefined;

/**
 * `nano-spawn` must be async imported since it's ESM and beachball currently isn't.
 * Await this promise to get the default spawn function.
 */
export async function importNanoSpawn(): Promise<typeof nanoSpawnType.default> {
  _nanoSpawn ??= (await import('nano-spawn')).default;
  return _nanoSpawn;
}

export type SpawnOptions = nanoSpawnType.Options & {
  /** cwd for command (required to avoid accidentally using `process.cwd()`) */
  cwd: string | undefined;

  /**
   * If true, set `stdout`/`stderr` to `'pipe'` *and* send them to the parent process's streams.
   * (This allows both capturing the output and seeing it live in the console.)
   */
  stdioPipeAndInherit?: boolean;
};

export type SpawnSubprocess = nanoSpawnType.Subprocess;

export type SpawnSuccessResult = nanoSpawnType.Result & { success: true };

export type SpawnError = nanoSpawnType.SubprocessError;
/** Error from `nano-spawn`. `cause` may contain the original error. */
export type SpawnErrorResult = nanoSpawnType.SubprocessError & {
  success: false;
  /** This will be true if a timeout was specified and the process took longer than that time. */
  timedOut?: true;
};

export type SpawnResult = SpawnSuccessResult | SpawnErrorResult;

/**
 * Wrapper for {@link nanoSpawnType.default | `nano-spawn`} to spawn child processes. Differences:
 * - If there's an error, return it as a result with `success: false` instead of rejecting.
 * - If the error is due to a timeout, set a `timedOut` property on the error result.
 * - Wait for the process to complete, rather than returning the subprocess handle. This is mainly
 *   because `nano-spawn` must be async imported and awaited before use.
 *   - If something needs direct access to the subprocess in a way that's not reasonably handled by
 *     a new option, use {@link importNanoSpawn} and call it directly.
 *
 * (Note that for npm/yarn commands, `nano-spawn` internally sets `shell: true` if needed to work around
 * [this issue](https://nodejs.org/en/blog/vulnerability/april-2024-security-releases-2).)
 *
 * @param cmd - The program/script to execute
 * @param args - Arguments to pass to `cmd` on execution.
 * @param options - Options for spawning the process.
 */
export async function spawn(cmd: string, args: string[], options: SpawnOptions): Promise<SpawnResult> {
  const nanoSpawn = await importNanoSpawn();

  try {
    const child = nanoSpawn(cmd, args, {
      ...options,
      // Don't pipe stdin
      ...(options.stdioPipeAndInherit && { stdout: 'pipe', stderr: 'pipe' }),
    });
    if (options.stdioPipeAndInherit) {
      const nodeChild = await child.nodeChildProcess;
      nodeChild.stdout?.pipe(process.stdout);
      nodeChild.stderr?.pipe(process.stderr);
    }

    const result = (await child) as SpawnSuccessResult;
    result.success = true;
    return result;
  } catch (e) {
    // nano-spawn appears to be well-behaved with about wrapping all errors, so assume the type
    const result = e as SpawnErrorResult;
    result.success = false;
    if (options.timeout && result.durationMs >= options.timeout) {
      result.timedOut = true;
    }
    return result;
  }
}
