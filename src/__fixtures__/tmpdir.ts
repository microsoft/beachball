import * as tmp from 'tmp';
import fs from 'fs-extra';
import os from 'os';
// import console to ensure that warnings are always logged if needed (no mocking)
import realConsole from 'console';

// tmp is supposed to be able to clean up automatically, but this doesn't always work within jest.
// So we attempt to use its built-in cleanup mechanisms, but tests should ideally do their own cleanup too.

// Clean up created directories when the program exits (even on uncaught exception)
tmp.setGracefulCleanup();

const windowsUserRegex = /^[a-z]:\\Users\\[^\\]+/i;
let windowsShortUserDir: string | undefined;
let windowsLongUserDir: string | undefined;

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
    // On Windows, if the user directory is more than 8 characters, os.tmpdir() (used by tmp) apparently
    // returns a path with the user directory segment as a short (8.3) name, like C:\Users\RUNNER~1\AppData\Local\Temp.
    // This messes up path comparisons with process.cwd() which uses long names.
    // There's no utility in Node to fix this,
    if (!(windowsShortUserDir && windowsLongUserDir)) {
      // Try to get the short and long versions of the user dir
      windowsShortUserDir = dir.match(windowsUserRegex)?.[0];
      windowsLongUserDir = os.homedir().match(windowsUserRegex)?.[0];
    }
    if (windowsShortUserDir && windowsLongUserDir) {
      dir = dir.replace(windowsShortUserDir, windowsLongUserDir);
    }
    if (dir.includes('~')) {
      realConsole.warn(
        `⚠️⚠️⚠️\nWARNING: temp directory "${dir}" contains a short (8.3) path segment which could not be expanded ` +
          'by available heuristics. This will likely cause test failures due to comparisons with long paths.\n⚠️⚠️⚠️'
      );
    }
  }

  return dir;
}
