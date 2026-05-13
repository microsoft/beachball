import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Read the `registry` setting from `.npmrc` files in the standard lookup order:
 * 1. Project-level `.npmrc` (at `cwd`)
 * 2. User-level `~/.npmrc`
 *
 * Environment variable substitution is supported using `${VAR_NAME}` syntax,
 * matching the behavior of npm's `.npmrc` parsing.
 *
 * Returns the first registry found, or `undefined` if none is set.
 */
export function getRegistryFromNpmrc(cwd: string, env: NodeJS.ProcessEnv = process.env): string | undefined {
  const npmrcPaths = [path.join(cwd, '.npmrc'), path.join(os.homedir(), '.npmrc')];

  for (const npmrcPath of npmrcPaths) {
    const registry = readRegistryFromFile(npmrcPath, env);
    if (registry) {
      return registry;
    }
  }

  return undefined;
}

/**
 * Substitute `${VAR_NAME}` references with values from the environment,
 * matching the behavior of `@npmcli/config`. Unset variables resolve to empty string.
 */
function substituteEnvVars(value: string, env: NodeJS.ProcessEnv): string {
  return value.replace(/\$\{([^}]+)\}/g, (_match, varName: string) => env[varName] ?? '');
}

function readRegistryFromFile(filePath: string, env: NodeJS.ProcessEnv): string | undefined {
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
      return substituteEnvVars(match[1].trim(), env);
    }
  }

  return undefined;
}
