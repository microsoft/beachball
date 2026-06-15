import { afterAll, afterEach } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Per-test temp-directory helper. Returns a `getTempDir()` function that creates a fresh
 * temp directory on first call (lazy) and is cleaned up automatically by an `afterEach` or `afterAll`.
 *
 * Call this **outside** of any lifecycle hooks (it registers the appropriate hook itself).
 */
export function setupTempDir(options?: { prefix?: string; cleanup?: 'afterEach' | 'afterAll' }): {
  /** Get the path to the temp directory, creating it if necessary. */
  getTempDir: () => string;
} {
  const { prefix = 'esrp-npm-release-test-', cleanup = 'afterEach' } = options || {};
  let tempDir: string | undefined;

  const afterHook = cleanup === 'afterAll' ? afterAll : afterEach;
  afterHook(() => {
    removeTempDir(tempDir);
    tempDir = undefined;
  });

  return {
    getTempDir: () => {
      tempDir ??= fs.mkdtempSync(path.join(os.tmpdir(), prefix));
      return tempDir;
    },
  };
}

/** Remove a temp directory and ignore errors */
export function removeTempDir(tempDir: string | undefined): void {
  try {
    tempDir && fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

/**
 * Build a fake "packed packages" directory at `parentDir` containing the requested layers.
 * Each layer is a numbered subdirectory (e.g. "0", "1") with empty `.tgz` files inside.
 *
 * @example
 *   const packedDir = createPackedDir(getTempDir(), {
 *     '0': ['pkg-a-1.0.0.tgz'],
 *     '1': ['pkg-b-2.0.0.tgz', 'pkg-c-3.0.0.tgz'],
 *   });
 *
 * @returns Path to the created packed-packages directory
 */
export function createPackedDir(parentDir: string, layers: Record<string, string[]>): string {
  const packedDir = path.join(parentDir, 'packed');
  fs.mkdirSync(packedDir, { recursive: true });
  for (const [layerName, files] of Object.entries(layers)) {
    const layerDir = path.join(packedDir, layerName);
    fs.mkdirSync(layerDir, { recursive: true });
    for (const file of files) {
      fs.writeFileSync(path.join(layerDir, file), `mock contents of ${file}`);
    }
  }
  return packedDir;
}
