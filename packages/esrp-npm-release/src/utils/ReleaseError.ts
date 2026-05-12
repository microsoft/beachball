/**
 * Custom error class for expected/handled release errors.
 *
 * When `alreadyLogged` is true, it means the detailed error information has already been printed
 * to stderr before the error was thrown. The top-level exit handler should NOT re-log the error
 * details in that case.
 *
 * If `cause` is provided and `alreadyLogged` isn't true, the exit handler will print the message
 * from the cause.
 */
export class ReleaseError extends Error {
  /** If true, detailed error info was already logged via console.error before throwing. */
  public alreadyLogged: boolean;

  public constructor(
    message: string,
    options?: {
      /** If true, the exit handler won't log anything */
      alreadyLogged?: boolean;
      /**
       * Underlying cause. Its message will be printed by the exit handler if `alreadyLogged`
       * is not set.
       */
      cause?: unknown;
    }
  ) {
    super(message, { cause: options?.cause });
    this.name = 'ReleaseError';
    this.alreadyLogged = !!options?.alreadyLogged;
  }

  public getMessageWithCause(): string {
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    return `${this.message}${this.cause ? `:\n${(this.cause as Error).message || String(this.cause)}` : ''}`;
  }
}
