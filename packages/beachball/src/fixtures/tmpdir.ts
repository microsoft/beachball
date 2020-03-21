import * as tmp from 'tmp';

// Clean up created directories when the program exits
tmp.setGracefulCleanup();

export type DirResult = tmp.DirResult;

export async function tmpdir(options: tmp.DirOptions): Promise<tmp.DirResult> {
  return new Promise((resolve, reject) => {
    tmp.dir(options, (err, name, removeCallback) => {
      if (err) {
        reject(err);
      } else {
        resolve({ name, removeCallback });
      }
    });
  });
}
