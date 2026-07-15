/** Log an ADO pipeline error and exit with a non-zero code. */
export function adoFail(message: string): never {
  console.log(`##vso[task.logissue type=error]${message}`);
  process.exit(1);
}

export function adoWarn(message: string): void {
  console.log(`##vso[task.logissue type=warning]${message}`);
}

/** Sleep for the given number of seconds. */
export const sleep = (seconds: number): Promise<void> => new Promise(resolve => setTimeout(resolve, seconds * 1000));

/**
 * Get a URL, with up to 3 attempts.
 */
export async function fetchWithRetry<T>(url: string, options?: { authHeader?: string }): Promise<T> {
  const { authHeader } = options ?? {};
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, authHeader ? { headers: { Authorization: authHeader } } : {});
      if (!res.ok) {
        throw new Error(`Request failed (${res.status} ${res.statusText})`);
      }
      return res.json() as Promise<T>;
    } catch (err) {
      lastError = err;
      console.warn(`Error fetching ${url} (attempt ${attempt}): ${(err as Error).message || String(err)}`);
      if (attempt < 3) {
        await sleep(attempt);
      }
    }
  }
  throw lastError;
}
