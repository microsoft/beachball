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
 * Also writes a `versions.json` next to the layer directories matching the shape produced by
 * beachball's `publishToRegistry`. By default, package name and version are parsed from each
 * `.tgz` filename (`<name>-<version>.tgz`); pass `layerVersions` to override for invalid cases.
 *
 * Returns the path to the created packed-packages directory.
 *
 * @example
 *   const packedDir = createPackedDir(getTempDir(), {
 *     '0': ['pkg-a-1.0.0.tgz'],
 *     '1': ['pkg-b-2.0.0.tgz', 'pkg-c-3.0.0.tgz'],
 *   });
 */
export function createPackedDir(
  parentDir: string,
  layers: Record<string, string[]>,
  layerVersions?: Record<string, string>[]
): string {
  const packedDir = path.join(parentDir, 'packed');
  fs.mkdirSync(packedDir, { recursive: true });
  for (const [layerName, files] of Object.entries(layers)) {
    const layerDir = path.join(packedDir, layerName);
    fs.mkdirSync(layerDir, { recursive: true });
    for (const file of files) {
      fs.writeFileSync(path.join(layerDir, file), `mock contents of ${file}`);
    }
  }

  const versions = layerVersions ?? deriveVersionsFromTgzFiles(layers);
  fs.writeFileSync(path.join(packedDir, 'versions.json'), JSON.stringify(versions, null, 2));

  return packedDir;
}

/**
 * Parse `<name>-<version>.tgz` filenames into a versions.json-shaped array, in the same
 * sorted-layer-name order that `runRelease` iterates. Non-numeric layer names (e.g.
 * `_manifest`) are skipped so the resulting array lines up 1:1 with the layers.
 */
function deriveVersionsFromTgzFiles(layers: Record<string, string[]>): Record<string, string>[] {
  const numericLayerNames = Object.keys(layers)
    .filter(name => /^\d+$/.test(name))
    .sort();
  return numericLayerNames.map(layerName => {
    const entries: [string, string][] = [];
    for (const file of layers[layerName]) {
      if (!file.endsWith('.tgz')) continue;
      const match = /^(.+)-(\d[\w.+-]*)\.tgz$/.exec(file);
      if (match) entries.push([match[1], match[2]]);
    }
    return Object.fromEntries(entries);
  });
}
