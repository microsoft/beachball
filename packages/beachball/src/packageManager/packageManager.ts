import execa from 'execa';
import { filterPathForNpm } from './npmAuthEnvPassthrough';

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
    pathEnv = filterPathForNpm(pathEnv);
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
