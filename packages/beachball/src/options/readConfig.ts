import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { getPackageInfo } from 'workspace-tools';
import { BeachballError } from '../types/BeachballError';

/** Module file extensions supported for config files */
const moduleExtensions = ['js', 'cjs', 'mjs', 'ts', 'cts', 'mts'];

interface ConfigResult<TConfig> {
  /** The loaded config value. */
  config: TConfig;
  /** Absolute path to the file the config was loaded from. */
  filepath: string;
}

/**
 * Search `cwd` (only, not parent directories) for a config file for `name`.
 * This implements a subset of `cosmiconfig`'s behavior, considering these locations (in order):
 * - a package.json property `<name>`
 * - a `<name>.config.<ext>` with extensions `.[cm]?[jt]s`
 * - a JSON extensionless "rc file" `.<name>rc`
 * - an "rc file" `.<name>rc.<ext>` with the extensions `.json`, `.[cm]?[jt]s`
 * - any of the above (except package.json) under a `.config` directory
 *
 * @returns The loaded config and the file it came from, or null if no config was found
 */
export async function readConfig<TConfig = unknown>(params: {
  /** The name of the config (e.g., `beachball`) */
  name: string;
  /** The directory to search in */
  cwd: string;
  /** If provided, read this path instead of searching in `cwd` */
  customPath?: string;
}): Promise<ConfigResult<TConfig> | null> {
  const { name, cwd, customPath } = params;

  if (customPath) {
    const filepath = path.resolve(cwd, customPath);
    const config = await loadConfig<TConfig>(filepath);
    return { config, filepath };
  }

  // package.json "<name>" property
  const packageInfo = getPackageInfo(cwd);
  if (packageInfo?.[name]) {
    return { config: packageInfo?.[name] as TConfig, filepath: packageInfo.packageJsonPath };
  }

  const result = await searchDir<TConfig>(name, cwd);
  return result || (await searchDir<TConfig>(name, path.join(cwd, '.config')));
}

async function searchDir<TConfig>(name: string, dir: string): Promise<ConfigResult<TConfig> | null> {
  const searchPlaces = [
    `.${name}rc`,
    ...moduleExtensions.map(ext => `${name}.config.${ext}`),
    `.${name}rc.json`,
    ...moduleExtensions.map(ext => `.${name}rc.${ext}`),
  ];

  for (const searchPlace of searchPlaces) {
    const filepath = path.join(dir, searchPlace);
    if (isFile(filepath)) {
      const config = await loadConfig<TConfig>(filepath);
      return { config, filepath };
    }
  }

  return null;
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
      const imported = (await import(url)) as { default?: TConfig };
      return imported.default ?? (imported as TConfig);
    }
  } catch (err) {
    throw new BeachballError(
      `Failed to load config from ${filepath}: ${err instanceof Error ? err.stack || err.message : String(err)}`,
      { cause: err }
    );
  }
}
