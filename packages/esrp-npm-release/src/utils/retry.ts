/** Retry a function up to 10 times with exponential backoff */
export async function retry<T>(fn: (attempt: number) => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let run = 1; run <= 10; run++) {
    try {
      return await fn(run);
    } catch (err) {
      if (
        !/fetch failed|terminated|aborted|timeout|TimeoutError|Timeout Error|RestError|Client network socket disconnected|socket hang up|ECONNRESET|CredentialUnavailableError|endpoints_resolution_error|Audience validation failed|end of central directory record signature not found/i.test(
          (err as Error).message || ''
        )
      ) {
        throw err;
      }

      lastError = err;

      // maximum delay is 10th retry: ~3 seconds
      const millis = Math.floor(Math.random() * 200 + 50 * Math.pow(1.5, run));
      await new Promise(c => setTimeout(c, millis));
    }
  }

  console.error(`Too many retries, aborting.`);
  throw lastError;
}
