import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Read the `registry` setting from `.npmrc` files in the standard lookup order:
 * 1. Project-level `.npmrc` (at `cwd`)
 * 2. User-level `~/.npmrc`
 *
 * Returns the first registry found, or `undefined` if none is set.
 */
export function getRegistryFromNpmrc(cwd: string): string | undefined {
  const npmrcPaths = [path.join(cwd, '.npmrc'), path.join(os.homedir(), '.npmrc')];

  for (const npmrcPath of npmrcPaths) {
    const registry = readRegistryFromFile(npmrcPath);
    if (registry) {
      return registry;
    }
  }

  return undefined;
}

function readRegistryFromFile(filePath: string): string | undefined {
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return undefined;
  }

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) {
      continue;
    }
    // Match "registry=<url>" or "registry = <url>"
    const match = trimmed.match(/^registry\s*=\s*(.+)/i);
    if (match) {
      return match[1].trim();
    }
  }

  return undefined;
}
