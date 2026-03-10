/**
 * Custom error class for expected/handled beachball errors.
 *
 * When `alreadyLogged` is true, it means the detailed error information has
 * already been printed to stderr before the error was thrown. The top-level
 * catch handler in cli.ts should NOT re-log the error details in that case.
 */
export class BeachballError extends Error {
  /** If true, detailed error info was already logged via console.error before throwing. */
  readonly alreadyLogged: boolean;

  constructor(message: string, options?: { alreadyLogged?: boolean }) {
    super(message);
    this.name = 'BeachballError';
    this.alreadyLogged = !!options?.alreadyLogged;
  }
}
