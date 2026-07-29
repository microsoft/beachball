import { spawn, type SpawnOptions, type SpawnResult } from '../spawn';
import { filterPathForNpm } from './npmAuthEnvPassthrough';

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
  options: SpawnOptions & { cwd: string }
): Promise<SpawnResult> {
  let pathEnv = options.env?.PATH || process.env.PATH;
  if (manager === 'npm' && pathEnv) {
    pathEnv = filterPathForNpm(pathEnv);
  }

  return await spawn(manager, args, {
    ...options,
    env: { ...options.env, PATH: pathEnv },
  });
}
