import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getPackageInfo } from 'workspace-tools';
import { BeachballError } from '../types/BeachballError';
import type { BeachballOptions } from '../types/BeachballOptions';

const name = 'beachball';

/** Module file extensions supported for config files */
const moduleExtensions = ['json', 'js', 'cjs', 'mjs', 'ts', 'cts', 'mts'];

/**
 * Search `cwd` (only, not parent directories) for a `beachball` config file.
 * This implements a subset of `cosmiconfig`'s behavior, considering these locations (in order):
 * - a package.json property `beachball`
 * - a `beachball.config.<ext>` with extensions `.[cm]?[jt]s`
 * - a JSON extensionless "rc file" `.beachballrc`
 * - an "rc file" `.beachballrc.<ext>` with the extensions `.json`, `.[cm]?[jt]s`
 * - any of the above (except package.json) under a `.config` directory
 *
 * @returns The loaded config, or undefined if no config was found
 */
export async function readConfig<TConfig = unknown>(
  options: Pick<BeachballOptions, 'path' | 'configPath'>
): Promise<TConfig | undefined> {
  const { path: cwd, configPath: customPath } = options;

  if (customPath) {
    return await loadConfig<TConfig>(path.resolve(cwd, customPath));
  }

  // package.json "beachball" property
  const packageInfo = getPackageInfo(cwd);
  if (packageInfo?.[name]) {
    return packageInfo?.[name] as TConfig;
  }

  const result = await searchDir<TConfig>(cwd);
  return result || (await searchDir<TConfig>(path.join(cwd, '.config')));
}

async function searchDir<TConfig>(dir: string): Promise<TConfig | undefined> {
  const searchPlaces = [
    ...moduleExtensions.map(ext => `${name}.config.${ext}`),
    `.${name}rc`,
    ...moduleExtensions.map(ext => `.${name}rc.${ext}`),
  ];

  for (const searchPlace of searchPlaces) {
    const filepath = path.join(dir, searchPlace);
    if (isFile(filepath)) {
      return await loadConfig<TConfig>(filepath);
    }
  }
  return undefined;
}

/** Whether `filepath` exists and is a regular file. */
function isFile(filepath: string): boolean {
  try {
    return fs.statSync(filepath).isFile();
  } catch {
    return false;
  }
}

/** Try to load the file, or throw if there's an error */
async function loadConfig<TConfig>(filepath: string): Promise<TConfig> {
  try {
    // `.json` and the extensionless `.<name>rc` files are JSON; the rest are JS/TS modules.
    const ext = path.extname(filepath);
    if (ext === '.json' || !ext) {
      return JSON.parse(fs.readFileSync(filepath, 'utf8')) as TConfig;
    } else {
      // import() works most reliably with URLs on Windows
      const url = pathToFileURL(filepath).href;
      const imported = (await import(url)) as { default?: TConfig | { default?: TConfig } };
      // double default is probably a jest-transform-specific issue
      return ((imported.default as { default?: TConfig })?.default ?? imported.default ?? imported) as TConfig;
    }
  } catch (err) {
    throw new BeachballError(
      `Failed to load config from ${filepath}: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err }
    );
  }
}
