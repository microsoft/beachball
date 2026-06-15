import { jest } from '@jest/globals';
import { Logger, type LogMethod } from '../utils/Logger.ts';

type LogMocks = {
  [K in LogMethod]: jest.Mock<Logger[K]>;
};

/**
 * Capturing test double for `Logger`. All methods record their args into `lines` (with a
 * `[method]` prefix) and into `mocks[method]`/`mocks.startGroup`/`mocks.endGroup` for
 * fine-grained inspection.
 */
export class MockLogger extends Logger {
  /** All log/warn/error lines, in call order, prefixed with `[method]`. */
  public readonly lines: string[];
  public readonly mocks: LogMocks;
  #replacePaths: Record<string, string> = {};

  public constructor() {
    const lines: string[] = [];
    const capture = (method: LogMethod, ...args: unknown[]) => {
      let line = args.join(' ');
      for (const [path, replacement] of Object.entries(this.#replacePaths)) {
        line = line.replaceAll(path, replacement).replace(/\\/g, '/');
      }
      lines.push(`[${method}] ${line}`);
    };
    const mocks: LogMocks = {
      log: jest.fn(capture.bind(null, 'log')),
      warn: jest.fn(capture.bind(null, 'warn')),
      error: jest.fn(capture.bind(null, 'error')),
    };
    super(undefined, mocks);
    this.lines = lines;
    this.mocks = mocks;
  }

  /** Convenience: get all captured lines as a single string, for snapshots. */
  public getOutput(): string {
    return this.lines.join('\n');
  }

  /** Replace all occurrences of `path` with `replacement` in future log lines. */
  public addPath(path: string, replacement: string): void {
    this.#replacePaths[path] = replacement;
  }
}
