import type { Options as NanoSpawnOptions, Result as NanoSpawnResult } from 'nano-spawn';
import fs from 'fs';
import path from 'path';
import semver from 'semver';
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

let hasMatchingRenovate: true | undefined;

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

  if (!hasMatchingRenovate) {
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
 * Verify that Renovate is globally installed and the version is at least `renovate/.renovate-version`.
 * Throws if not installed.
 */
export async function verifyRenovate(): Promise<void> {
  if (hasMatchingRenovate) {
    return;
  }

  const expectedVersion = fs.readFileSync(path.join(paths.renovateRoot, '.renovate-version'), 'utf8').trim();

  console.log(`Verifying that Renovate is globally installed with version >= ${expectedVersion}...`);

  let renovateVersionResult: NanoSpawnResult;
  try {
    renovateVersionResult = await runBin('renovate', ['--version'], {
      cwd: paths.renovateRoot,
      stdio: 'pipe',
    });
  } catch {
    throw new Error(
      `Renovate is not installed or not available in PATH. Install Renovate globally and try again:\n` +
        `  npm i --min-release-age=7 -g renovate@${expectedVersion}`
    );
  }

  const installedVersion = renovateVersionResult.stdout.trim().replace(/^v/, '');

  if (semver.lt(installedVersion, expectedVersion)) {
    throw new Error(
      `Installed Renovate version (${installedVersion}) does not match expected version ` +
        `(${expectedVersion}). Install the expected version and try again.`
    );
  }

  hasMatchingRenovate = true;
  console.log(`Using installed Renovate ${installedVersion}`);
}
