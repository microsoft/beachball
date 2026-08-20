export type LogMethod = 'log' | 'warn' | 'error';

export class Logger {
  #prefix: string | undefined;
  #console: Pick<typeof console, LogMethod>;
  #groupStartTime: number | undefined;

  public constructor(prefix?: string, consoleImpl?: Pick<typeof console, LogMethod>) {
    this.#prefix = prefix;
    this.#console = consoleImpl ?? console;
  }

  /** Get the current prefix (if any) as an array that can be spread into console methods */
  private get prefix(): string[] {
    return this.#prefix ? [`[${this.#prefix}]`] : [];
  }

  public startGroup(prefix: string | undefined, title: string): void {
    this.#console.log(`##[group]${title}`);
    this.#prefix = prefix;
    this.#groupStartTime = Date.now();
  }

  /**
   * End the logging group, then log a separate line with the duration.
   */
  public endGroup(): void {
    const groupDuration = this.#groupStartTime && formatDuration(Date.now() - this.#groupStartTime);
    this.#groupStartTime = undefined;
    this.#prefix = undefined;

    this.#console.log(`##[endgroup]`);
    groupDuration && this.#console.log(`completed in ${groupDuration}`);
    this.#console.log('');
  }

  /** Log a prefixed message */
  public log(...args: unknown[]): void {
    this.#console.log(...this.prefix, ...args);
  }

  /** Log a prefixed warning, which will also be shown as an ADO build warning */
  public warn(...args: unknown[]): void {
    this.#console.warn(`##vso[task.logissue type=warning]`, ...this.prefix, ...args);
  }

  /** Log a prefixed error, which will also be shown as an ADO build error */
  public error(...args: unknown[]): void {
    this.#console.error(`##vso[task.logissue type=error]`, ...this.prefix, ...args);
  }
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1_000) {
    return `${durationMs}ms`;
  }

  const totalSeconds = Math.round(durationMs / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return minutes ? `${minutes}m ${seconds}s` : `${totalSeconds}s`;
}
