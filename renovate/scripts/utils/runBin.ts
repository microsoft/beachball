import type { Options as NanoSpawnOptions } from 'nano-spawn';
import fs from 'node:fs';
import { paths } from './paths.ts';
import { getRenovateEnv, type RenovateEnvParams } from './renovateLogs.ts';

const defaults: NanoSpawnOptions = {
  preferLocal: true,
  cwd: paths.renovateRoot,
  stdio: 'inherit',
};

/**
 * Run a binary provided by a node module (see {@link defaults})
 */
async function runBin(bin: string, args: string[], opts?: NanoSpawnOptions) {
  const nanoSpawn = (await import('nano-spawn')).default;
  return nanoSpawn(bin, args, { ...defaults, ...opts });
}

/**
 * Update the file contents and format with Prettier
 */
export async function updateAndFormat(file: string, newContents: string): Promise<void> {
  console.log(`Updating and formatting ${file}`);
  fs.writeFileSync(file, newContents);
  await runBin('prettier', ['--write', '--log-level=warn', file]);
}

let hasRenovate: true | undefined;

/**
 * Run Renovate from the configured working directory. Must call `verifyRenovate` first.
 * Does not reject on error.
 * @returns whether it succeeded
 */
export async function runRenovate(
  bin: 'renovate' | 'renovate-config-validator',
  params: RenovateEnvParams & { args?: string[] }
): Promise<boolean> {
  const { args = [], ...envParams } = params;

  if (!hasRenovate) {
    throw new Error('You must call verifyRenovate() before running Renovate');
  }

  console.log(`Running: ${[bin, ...args].join(' ')}`);

  try {
    await runBin(bin, args, { env: getRenovateEnv(envParams) });
    return true;
  } catch {
    return false;
  }
}

/**
 * Verify that Renovate is globally installed. Throws if not installed.
 */
export async function verifyRenovate(): Promise<void> {
  if (hasRenovate) {
    return;
  }

  console.log(`Verifying that Renovate is globally installed...`);

  let installedVersion: string;
  try {
    installedVersion = (
      await runBin('renovate', ['--version'], { cwd: paths.renovateRoot, stdio: 'pipe' })
    ).stdout.trim();
  } catch {
    throw new Error(`Renovate is not installed or not available in PATH. Run 'npm i -g renovate' and try again.`);
  }

  hasRenovate = true;
  console.log(`Using installed Renovate ${installedVersion}`);
}
