import { getEnv } from './utils/getEnv.ts';
import { defaultRepo, logError } from './utils/github.ts';

const checkUrl = 'https://api.github.com/repos/' + defaultRepo;

/**
 * Get the TOKEN environment variable, if set. Throws if `required` is true and the token is not present.
 */
export function getToken(required?: boolean): string | undefined {
  return getEnv('TOKEN', required);
}

/**
 * Renovate tends to fail silently on invalid tokens in some cases, so this script checks the token's
 * validity. It's also good for detecting if an invalid secret name was used.
 */
export async function checkToken(token: string): Promise<void> {
  if (!token) {
    throw new Error('GitHub token not provided (is the variable name valid?)');
  }
  if (!/^(gh[a-z]_|github_pat)/i.test(token)) {
    throw new Error(`Value starting with "${token.slice(0, 4)}" is not a GitHub token`);
  }

  let result: Response;
  try {
    result = await fetch(checkUrl, { headers: { Authorization: `Bearer ${token}` } });
  } catch (err) {
    throw new Error('Error checking GitHub token: ' + ((err as Error).message || String(err)), { cause: err });
  }

  if (!result.ok) {
    throw new Error(
      `GitHub token appears to be expired or invalid (received ${result.status} ${result.statusText} from ${checkUrl})`
    );
  }
}

if (import.meta.main) {
  await checkToken(process.argv[2]).catch(err => {
    logError(err);
    process.exit(1);
  });
  console.log('Token is valid');
}
