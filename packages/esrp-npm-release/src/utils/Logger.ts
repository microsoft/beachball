/* eslint-disable no-console */

export class Logger {
  #prefix: string | undefined;

  constructor(prefix?: string) {
    this.#prefix = prefix;
  }

  /** Get the current prefix (if any) as an array that can be spread into console methods */
  private get prefix(): string[] {
    return this.#prefix ? [`[${this.#prefix}]`] : [];
  }

  public startGroup(prefix: string | undefined, title: string): void {
    console.log(`##[group]${title}`);
    this.#prefix = prefix;
  }

  public endGroup(): void {
    console.log('##[endgroup]');
    this.#prefix = undefined;
  }

  /** Log a prefixed message */
  public log(...args: unknown[]): void {
    console.log(...this.prefix, ...args);
  }

  /** Log a prefixed warning, which will also be shown as an ADO build warning */
  public warn(...args: unknown[]): void {
    console.warn(`##vso[task.logissue type=warning]`, ...this.prefix, ...args);
  }

  /** Log a prefixed error, which will also be shown as an ADO build error */
  public error(...args: unknown[]): void {
    console.error(`##vso[task.logissue type=error]`, ...this.prefix, ...args);
  }
}
