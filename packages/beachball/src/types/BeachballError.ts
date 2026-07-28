/**
 * Custom error class for expected/handled beachball errors.
 * Only the message is logged on exit, not the stack.
 *
 * When `alreadyLogged` is true, it means the detailed error information has
 * already been printed to stderr before the error was thrown. The top-level
 * catch handler in cli.ts should NOT re-log the error details in that case.
 */
export class BeachballError extends Error {
  /** If true, detailed error info was already logged via console.error before throwing. */
  public readonly alreadyLogged: boolean;

  public constructor(message: string, options?: { alreadyLogged?: boolean } & ErrorOptions) {
    super(message, options);
    this.name = 'BeachballError';
    this.alreadyLogged = !!options?.alreadyLogged;
  }
}
