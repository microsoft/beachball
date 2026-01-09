import { jest, afterEach, beforeAll, afterAll } from '@jest/globals';

/** Methods that will be mocked. More could be added later if needed. */
type MockLogMethod = 'log' | 'warn' | 'error';
const mockedMethods: MockLogMethod[] = ['log', 'warn', 'error'];

type MockLogsOptions = {
  /**
   * Whether to also log to the real console (or subset of methods to log to the console).
   * All logging can be enabled by setting the VERBOSE env var.
   */
  alsoLog?: boolean | MockLogMethod[];
};

export type MockLogs = {
  /** Mocked methods (to access calls etc) */
  mocks: { [k in MockLogMethod]: jest.SpiedFunction<typeof console.log> };

  /** Set override options for one test only */
  setOverrideOptions: (options: MockLogsOptions) => void;

  /** Call `mockClear` on all mocks to reset calls */
  clear: () => void;

  /** Get the lines logged to a particular method (or all methods) */
  getMockLines: (
    method: MockLogMethod | 'all',
    opts?: {
      /** Replace this path with `<root>` and normalize slashes */
      root?: string;
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
  const jestConsole = { ...console };

  const logs: MockLogs = {
    mocks: {} as MockLogs['mocks'],
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

      if (opts.root) {
        // Normalize slashes then replace the root path
        lines = lines.replace(/\\/g, '/').replaceAll(opts.root.replace(/\\/g, '/'), '<root>');
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
    for (const method of mockedMethods) {
      const mainShouldLog = shouldLog(method, alsoLog);

      logs.mocks[method] = jest.spyOn(console, method).mockImplementation((...args) => {
        const currentShouldLog =
          overrideOptions === undefined ? mainShouldLog : shouldLog(method, overrideOptions.alsoLog);
        allLines.push([`[${method}]`, ...args]);
        if (process.env.VERBOSE || currentShouldLog) {
          jestConsole[method](...args);
        }
      });
    }
  });

  afterEach(() => {
    logs.clear();
  });

  afterAll(() => {
    Object.values(logs.mocks).forEach(mock => mock.mockRestore());
  });

  return logs;
}

function shouldLog(method: MockLogMethod, alsoLog: boolean | MockLogMethod[] | undefined) {
  return typeof alsoLog === 'boolean' ? alsoLog : alsoLog?.includes(method);
}
