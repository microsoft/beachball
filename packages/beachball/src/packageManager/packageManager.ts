import execa from 'execa';
import path from 'path';

export type PackageManagerResult = execa.ExecaReturnValue & { success: boolean };
export type PackageManagerOptions = execa.Options & { cwd: string };

/**
 * Run a package manager command. Returns the error result instead of throwing on failure.
 * @param manager The package manager to use
 * @param args Package manager command and arguments
 * @param options cwd must be specified in options to reduce the chance of accidentally running
 * commands in the wrong place. If it's definitely irrelevant in this case, use undefined.
 */
export async function packageManager(
  manager: 'npm' | 'yarn' | 'pnpm',
  args: string[],
  options: PackageManagerOptions
): Promise<PackageManagerResult> {
  let pathEnv = options.env?.PATH || process.env.PATH;
  if (manager === 'npm' && pathEnv) {
    // Workaround for an issue on certain platforms/shells(?) if the parent command was run VIA yarn:
    // The auth environment variable (e.g. `npm_config_//someRegistry/:_authToken`) was not being
    // passed through to the child process. This might be because:
    // - Special characters such as / and : aren't valid in env var names for certain shells/platforms
    // - On every `yarn run ...` command, yarn makes temp directories like /<temp>/yarn--1776822418161-0.7992675923334178
    //   with aliases for `node` and `yarn`. On Linux (and Mac), the `node` alias looks something like:
    //     #!/bin/sh
    //     exec "/path/to/node" "$@"
    //   (see https://github.com/yarnpkg/yarn/issues/6685 for context)
    // - Best guess: invalid environment variable names are dropped by this extra `exec` step??
    //   (This consistently reproed on Ubuntu+bash, but not Mac+zsh or bash. The clue was that the
    //   tests passed even on Linux when run via debugTests.js, but failed when run via yarn test.)
    //
    // Removing the yarn-- segment from the PATH seems to consistently fix this issue.
    pathEnv = pathEnv
      .split(path.delimiter)
      .filter(p => !path.basename(p).startsWith('yarn--'))
      .join(path.delimiter);
  }

  try {
    const result = await execa(manager, args, {
      ...options,
      env: { ...options.env, PATH: pathEnv },
      // This is required for Windows due to https://nodejs.org/en/blog/vulnerability/april-2024-security-releases-2
      // but only provide it on Windows because it breaks the auth env var on Linux...
      ...(process.platform === 'win32' && { shell: true }),
    });
    return {
      ...result,
      success: !result.failed,
    };
  } catch (e) {
    return {
      ...(e as execa.ExecaError),
      success: false,
    };
  }
}
