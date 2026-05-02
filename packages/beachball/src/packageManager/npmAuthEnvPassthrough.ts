import execa from 'execa';
import path from 'path';
import type { BeachballOptions } from '../types/BeachballOptions';
import { getNpmAuthEnv } from './npmArgs';
import { BeachballError } from '../types/BeachballError';
import { findPackageRoot, getPackageInfo } from 'workspace-tools';

/**
 * Filter PATH for running npm commands, removing entries that contain shell-script node wrappers.
 *
 * Package managers inject temp directories into PATH with shims for `node` — yarn classic uses
 * `yarn--*` dirs, yarn berry uses `xfs-*` dirs. (Context: https://github.com/yarnpkg/yarn/issues/6685 -
 * yarn berry does similar but cleans up afterwards.)
 *
 * These shims are POSIX shell scripts, e.g. this `node` shim:
 *    ```sh
 *    #!/bin/sh
 *    exec "/path/to/node" "$@"
 *    ```
 *
 * Problem is POSIX `sh` drops env var names with invalid characters like `/` and `:`, which are
 * needed for npm auth token env vars (e.g. `npm_config_//someRegistry/:_authToken`).
 *
 * Removing those path entries fixes the issue and is unlikely to cause other problems in this context.
 * Use `checkNpmAuthEnvPassthrough` after this filter to detect unknown variants of this issue.
 */
export function filterPathForNpm(pathEnv: string): string {
  return pathEnv
    .split(path.delimiter)
    .filter(p => {
      const base = path.basename(p);
      return !base.startsWith('yarn--') && !base.startsWith('xfs-');
    })
    .join(path.delimiter);
}

/**
 * Check whether env vars with special characters in their names (like npm auth token env vars,
 * which contain `//` and `:`) will be passed through to npm subprocesses. Runs a test using the same
 * PATH filtering applied to actual npm commands, so a failure here means the fix in
 * `filterPathForNpm` doesn't cover this platform/environment variant.
 */
export async function checkNpmAuthEnvPassthrough(
  options: Pick<BeachballOptions, 'registry' | 'path'> & {
    /** PATH override only for testing */
    pathEnv?: string;
  }
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const pathEnv = options.pathEnv ?? process.env.PATH!;
  const fakeToken = 'fake-token';
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- always defined if token is passed
  const tokenEnv = getNpmAuthEnv({ registry: options.registry, token: fakeToken })!;
  const envName = Object.keys(tokenEnv)[0];

  const filteredPath = filterPathForNpm(pathEnv);
  try {
    const result = await execa('node', ['-e', `process.stdout.write(process.env[${JSON.stringify(envName)}] || '')`], {
      env: { ...tokenEnv, PATH: filteredPath },
      extendEnv: true,
    });
    if (result.stdout === fakeToken) {
      return;
    }
  } catch {
    // ignore
  }

  let relBeachballBin: string | undefined;
  const beachballRoot = findPackageRoot(__dirname);
  const beachballPkg = beachballRoot ? getPackageInfo(beachballRoot) : undefined;
  // This should usually be found unless the code was bundled or something
  if (beachballRoot && beachballPkg?.name === 'beachball' && beachballPkg.bin) {
    const binValue =
      typeof beachballPkg.bin === 'string' ? beachballPkg.bin : (beachballPkg.bin as { beachball: string }).beachball;
    const beachballBinPath = path.join(beachballRoot, binValue);
    relBeachballBin = path.relative(options.path, beachballBinPath);
  }

  console.error(
    [
      `The environment variable used to pass the npm auth token to "npm publish" is not being ` +
        `passed to npm subprocesses. This is typically caused by a shell script node wrapper in ` +
        `your PATH (e.g. injected by a package manager).`,
      '',
      `Please file an issue with beachball so this can be investigated. Your PATH:`,
      pathEnv,
      ...(relBeachballBin
        ? ['', `In the meantime, you can try running the CLI directly via Node:`, `  node ${relBeachballBin} <args>`]
        : []),
    ].join('\n')
  );

  throw new BeachballError('Error passing npm auth token', { alreadyLogged: true });
}
