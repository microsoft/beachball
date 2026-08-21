import { RestError } from '@azure/storage-blob';
import { ReleaseError } from './ReleaseError.ts';
import type { Logger } from './Logger.ts';

/** Returns whether an HTTP status indicates a transient failure. */
export function isTransientHttpStatus(statusCode: number | undefined): boolean {
  return (
    statusCode === 408 || statusCode === 429 || (statusCode !== undefined && statusCode >= 500 && statusCode < 600)
  );
}

/** Returns whether an Azure operation failed for a transient reason. */
export function isRetryableAzureError(error: unknown): boolean {
  if (error instanceof ReleaseError) {
    return error.retryable;
  }

  return (
    error instanceof RestError &&
    (error.code === RestError.REQUEST_SEND_ERROR ||
      error.code === RestError.PARSE_ERROR ||
      isTransientHttpStatus(error.statusCode))
  );
}

const maxAttempts = 4;

/**
 * Runs an operation up to four times, retrying only explicitly retryable `ReleaseError`s with
 * exponential backoff and jitter starting from a one-second base delay. All other errors are
 * rethrown immediately.
 */
export async function retryReleaseError<T>(
  logger: Logger,
  getAttemptDescription: (
    /** Will be `attempt X of Y` */
    attempt: string
  ) => string,
  operation: () => Promise<T>
): Promise<T> {
  let attempt = 1;
  while (true) {
    try {
      return await operation();
    } catch (error) {
      if (!(error instanceof ReleaseError) || !error.retryable || attempt === maxAttempts) {
        throw error;
      }

      const baseDelay = 1000 * 2 ** (attempt - 1);
      const delay = Math.floor(baseDelay / 2 + Math.random() * (baseDelay / 2));
      logger.warn(
        `${getAttemptDescription(`attempt ${attempt} of ${maxAttempts}`)} failed; retrying in ${delay}ms:`,
        error
      );
      await new Promise(resolve => setTimeout(resolve, delay));
      attempt++;
    }
  }
}
