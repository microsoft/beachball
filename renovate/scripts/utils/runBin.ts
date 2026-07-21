import execa from 'execa';
import fs from 'fs';
import path from 'path';
import semver from 'semver';
import { paths } from './paths.ts';
import { getRenovateEnv, type RenovateEnvParams } from './renovateLogs.ts';

const defaults: execa.Options = {
  preferLocal: true,
  cwd: paths.renovateRoot,
  stdio: 'inherit',
  all: true,
  reject: true,
};

/**
 * Run a binary provided by a node module (see {@link defaults})
 */
export function runBin(bin: string, args: string[], opts?: execa.Options): execa.ExecaChildProcess {
  console.log(`Running: ${bin} ${args.join(' ')}`);
  return execa(bin, args, { ...defaults, ...opts });
}

/**
 * Update the file contents and format with Prettier
 */
export async function updateAndFormat(file: string, newContents: string): Promise<void> {
  fs.writeFileSync(file, newContents);
  await runBin('prettier', ['--write', '--log-level=warn', file]);
}

let hasMatchingRenovate: true | undefined;

/**
 * Run Renovate from the configured working directory. Must call `verifyRenovate` first.
 * Does not reject on error, and the log level defaults to `warn` (avoiding a giant log
 * of the entire merged config in the main build logs).
 */
export function runRenovate(
  bin: 'renovate' | 'renovate-config-validator',
  params: RenovateEnvParams & { args?: string[] }
): execa.ExecaChildProcess {
  const { args = [], ...envParams } = params;

  if (!hasMatchingRenovate) {
    throw new Error('You must call verifyRenovate() before running Renovate');
  }

  return runBin(bin, args, { env: getRenovateEnv(envParams), reject: false });
}

/**
 * Verify that Renovate is globally installed and the version is at least `renovate/.renovate-version`.
 */
export async function verifyRenovate(): Promise<void> {
  if (hasMatchingRenovate) {
    return;
  }

  const expectedVersion = fs.readFileSync(path.join(paths.renovateRoot, '.renovate-version'), 'utf8').trim();

  console.log(`Verifying that Renovate is globally installed with version >= ${expectedVersion}...`);

  const renovateVersionResult = await runBin('renovate', ['--version'], {
    cwd: paths.renovateRoot,
    stdio: 'pipe',
    reject: false,
  });
  if (renovateVersionResult.failed) {
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
