import * as fs from 'fs-extra';
import * as tmp from 'tmp';
import { normalizedTmpdir } from 'normalized-tmpdir';
// import console to ensure that warnings are always logged if needed (no mocking)
import realConsole from 'console';
import { env } from '../env';

// tmp is supposed to be able to clean up automatically, but this doesn't always work within jest.
// So we attempt to use its built-in cleanup mechanisms, but tests should ideally do their own cleanup too.

// Clean up created directories when the program exits (even on uncaught exception)
tmp.setGracefulCleanup();

/**
 * Create a temporary directory and return the normalized real path to the directory.
 *
 * @param options See {@link tmp.DirOptions}. The default for `prefix` is `beachball-`, and
 * `unsafeCleanup` (try to delete on exit even if the dir contains files) is always enabled.
 */
export function tmpdir(options?: tmp.DirOptions): string {
  return tmp.dirSync({
    prefix: 'beachball-',
    ...options,
    // "Unsafe" means delete on exit even if it still contains files...which actually is safe.
    unsafeCleanup: true,
    // Create a directory starting with this normalized path
    tmpdir: normalizedTmpdir({ console: realConsole }),
  }).name;
}

/**
 * Clean up the folder if this is a local build.
 *
 * Doing this in CI is unnecessary because all the fixtures use unique temp directories (no collisions)
 * and the agents are wiped after each job, so manually deleting the files just slows things down.
 */
export function removeTempDir(dir: string | undefined): void {
  try {
    // This occasionally throws on Windows with "resource busy"
    if (dir && !env.isCI) {
      fs.removeSync(dir);
    }
  } catch (err) {
    // This is non-fatal since the temp dir will eventually be cleaned up automatically
    console.warn(`Could not clean up temp folder ${dir}:\n${err}`);
  }
}
