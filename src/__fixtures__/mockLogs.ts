import { jest, afterEach, beforeAll, afterAll } from '@jest/globals';
import { setTransports, restoreTransports } from '../logging/logger';
import type { LogLevel, LogTransport } from '../logging/logger';

/** Methods that will be mocked. More could be added later if needed. */
const mockedMethods: Record<LogLevel, true> = {
  log: true,
  warn: true,
  error: true,
};

type MockLogsOptions = {
  /**
   * Whether to also log to the real console (or subset of methods to log to the console).
   * All logging can be enabled by setting the VERBOSE env var.
   */
  alsoLog?: boolean | LogLevel[];
};

export type MockLogs = {
  /** Mocked methods (to access calls etc) */
  mocks: { [k in LogLevel]: jest.Mock<(...args: unknown[]) => void> };

  /** Set override options for one test only */
  setOverrideOptions: (options: MockLogsOptions) => void;

  /** Call `mockClear` on all mocks to reset calls */
  clear: () => void;

  /** Get the lines logged to a particular method (or all methods) */
  getMockLines: (
    method: LogLevel | 'all',
    opts?: {
      /** Replace this path with `<root>` and normalize slashes */
      root?: string;
      /** Mapping from path to placeholder text, e.g. `{ [packToPath]: '<packPath>' }` */
      replacePaths?: Record<string, string>;
      /**
       * Sanitize GUIDs, full commit hashes, and publish branch timestamps.
       *
       * NOTE: For output that lists change files, you may also want `sort` or other careful
       * handling to ensure returned log order can't vary due to limited filesystem timestamp
       * resolution or other reasons.
       */
      sanitize?: boolean;
      /** Sort lines alphabetically */
      sort?: boolean;
    }
  ) => string;
};

/**
 * Initialize console log mocks, which will be reset after each test. This should be called **outside**
 * of any lifecycle hooks or tests because it calls lifecycle hooks internally for setup and teardown.
 */
export function initMockLogs(options: MockLogsOptions = {}): MockLogs {
  const { alsoLog } = options;
  let allLines: unknown[][] = [];
  let overrideOptions: MockLogsOptions | undefined;

  const mocks = Object.fromEntries(
    Object.keys(mockedMethods).map(m => [m, jest.fn<(...args: unknown[]) => void>()])
  ) as MockLogs['mocks'];

  const capturingTransport: LogTransport = (level, args) => {
    mocks[level](...args);
    allLines.push([`[${level}]`, ...args]);

    const currentAlsoLog = overrideOptions?.alsoLog ?? alsoLog;
    if (process.env.VERBOSE || shouldLog(level, currentAlsoLog)) {
      const consoleMethod = level === 'log' ? 'log' : level;
      console[consoleMethod](...args);
    }
  };

  const logs: MockLogs = {
    mocks,
    setOverrideOptions: opt => {
      overrideOptions = opt;
    },
    clear: () => {
      allLines = [];
      overrideOptions = undefined;
      Object.values(logs.mocks).forEach(mock => mock.mockClear());
    },
    getMockLines: (method, opts = {}) => {
      let lines = (method === 'all' ? allLines : logs.mocks[method].mock.calls)
        .map(args =>
          args
            .join(' ')
            .split('\n')
            .map(l => l.trimEnd()) // prevent trailing whitespace in snapshots
            .join('\n')
        )
        .join('\n')
        .trim();

      if (opts.root || opts.replacePaths) {
        const replacePaths = { ...opts.replacePaths, ...(opts.root && { [opts.root]: '<root>' }) };
        // Normalize slashes first to ensure they're the same, then emulate replaceAll
        lines = lines.replace(/\\/g, '/');
        for (const [key, value] of Object.entries(replacePaths)) {
          lines = lines.split(key.replace(/\\/g, '/')).join(value);
        }
      }

      if (opts.sanitize) {
        lines = lines
          // Replace GUIDs with <guid>
          .replace(/[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}/g, '<guid>')
          // Replace publish branch names with publish_<timestamp>
          .replace(/publish_\d+/g, 'publish_<timestamp>')
          // Replace full git hashes with <commit>
          .replace(/\b[0-9a-f]{40}\b/g, '<commit>');
      }
      if (opts.sort) {
        lines = lines.split('\n').sort().join('\n');
      }

      return lines;
    },
  };

  beforeAll(() => {
    setTransports([capturingTransport]);
  });

  afterEach(() => {
    logs.clear();
  });

  afterAll(() => {
    restoreTransports();
  });

  return logs;
}

function shouldLog(method: LogLevel, alsoLog: boolean | LogLevel[] | undefined) {
  return typeof alsoLog === 'boolean' ? alsoLog : alsoLog?.includes(method);
}
