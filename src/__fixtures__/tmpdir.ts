import * as tmp from 'tmp';
import fs from 'fs-extra';
import os from 'os';
// import console to ensure that warnings are always logged if needed (no mocking)
import realConsole from 'console';

// tmp is supposed to be able to clean up automatically, but this doesn't always work within jest.
// So we attempt to use its built-in cleanup mechanisms, but tests should ideally do their own cleanup too.

// Clean up created directories when the program exits (even on uncaught exception)
tmp.setGracefulCleanup();

/**
 * Create a temporary directory and return the normalized real path to the directory.
 * This includes workarounds for both Mac and Windows quirks which cause path comparison problems.
 *
 * @param options See {@link tmp.DirOptions}. The default for `prefix` is `beachball-`, and
 * `unsafeCleanup` (try to delete on exit even if the dir contains files) is always enabled.
 */
export function tmpdir(options?: tmp.DirOptions): string {
  // Get the real path because on Mac, tmp will return /var/... which is actually a symlink to /private/var/...
  // (and mixing the symlink path and the real path causes issues in functions that use relative paths)
  let dir = fs.realpathSync(
    tmp.dirSync({
      prefix: 'beachball-',
      ...options,
      // "Unsafe" means delete on exit even if it still contains files...which actually is safe.
      unsafeCleanup: true,
    }).name
  );

  if (os.platform() === 'win32' && dir.includes('~')) {
    // On Windows, if the user directory is more than 8 characters, os.tmpdir() (used by tmp)
    // apparently returns a path with the user directory segment as a short (8.3) name, such as
    // C:\Users\RUNNER~1\AppData\Local\Temp on the github actions runner. This messes up path
    // comparisons against anything based on process.cwd() which uses long names.
    //
    // There's no official way to convert between short and long names in Node, so try a string
    // replacement of the short user segment with the home directory.
    const windowsShortUserDir = dir.match(/^[a-z]:\\Users\\[^\\]+/i)?.[0];
    const homedir = os.homedir();
    // replace if the drive letter is the same
    if (windowsShortUserDir && homedir[0].toLowerCase() === windowsShortUserDir[0].toLowerCase()) {
      dir = dir.replace(windowsShortUserDir, homedir);
    }
    if (dir.includes('~')) {
      // This could happen if the ~ was somewhere else besides the user directory, or if the
      // temp directory is not under the home directory.
      realConsole.warn(
        `⚠️⚠️⚠️\nWARNING: temp directory "${dir}" contains a short (8.3) path segment which could not be expanded ` +
          'by available heuristics. This will likely cause test failures due to comparisons with long paths.\n⚠️⚠️⚠️'
      );
    }
  }

  return dir;
}
