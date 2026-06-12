import spawn from 'nano-spawn';

/**
 * Resolve a GitHub auth token, in priority order:
 * 1. The explicitly provided token (e.g. from `--token`).
 * 2. The `GITHUB_TOKEN` or `GH_TOKEN` environment variables.
 * 3. The output of `gh auth token` (if the GitHub CLI is installed and authenticated).
 *
 * Returns `undefined` if no token could be resolved.
 */
export async function resolveToken(
  explicitToken?: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<string | undefined> {
  if (explicitToken) {
    return explicitToken;
  }

  const envToken = env.GITHUB_TOKEN || env.GH_TOKEN;
  if (envToken) {
    return envToken;
  }

  try {
    const { stdout } = await spawn('gh', ['auth', 'token']);
    return stdout.trim() || undefined;
  } catch {
    // gh not installed or not authenticated; fall through to unauthenticated.
    return undefined;
  }
}
