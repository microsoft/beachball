import * as tmp from 'tmp';

// tmp is supposed to be able to clean up automatically, but this doesn't always work within jest.
// So we attempt to use its built-in cleanup mechanisms, but tests should ideally do their own cleanup too.

// Clean up created directories when the program exits (even on uncaught exception)
tmp.setGracefulCleanup();

export async function tmpdir(options: tmp.DirOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    // "unsafe" means delete on exit even if it still contains files...which actually is safe
    tmp.dir({ ...options, unsafeCleanup: true }, (err, name) => {
      if (err) {
        reject(err);
      } else {
        resolve(name);
      }
    });
  });
}
