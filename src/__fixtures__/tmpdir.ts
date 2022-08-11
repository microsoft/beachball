import * as tmp from 'tmp';
import fs from 'fs-extra';

// tmp is supposed to be able to clean up automatically, but this doesn't always work within jest.
// So we attempt to use its built-in cleanup mechanisms, but tests should ideally do their own cleanup too.

// Clean up created directories when the program exits (even on uncaught exception)
tmp.setGracefulCleanup();

export function tmpdir(options: tmp.DirOptions): string {
  // Get the real path because on Mac, tmp will return /var/... which is actually a symlink to /private/var/...
  // (and mixing the symlink path and the real path causes issues in functions that use relative paths)
  return fs.realpathSync(
    tmp.dirSync({
      ...options,
      // "Unsafe" means delete on exit even if it still contains files...which actually is safe.
      unsafeCleanup: true,
    }).name
  );
}
