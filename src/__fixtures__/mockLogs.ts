import { jest, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import type { SpyInstance } from 'jest-mock';

/** Methods that will be mocked. More could be added later if needed. */
export type MockLogMethod = 'log' | 'warn' | 'error';
const mockedMethods: MockLogMethod[] = ['log', 'warn', 'error'];

export type MockLogsOptions = {
  /**
   * Whether to also log to the real console (or subset of methods to log to the console).
   * All logging can be enabled by setting the VERBOSE env var.
   */
  alsoLog?: boolean | MockLogMethod[];

  /**
   * If true, init and teardown in beforeAll/afterAll instead of beforeEach/afterEach.
   */
  onlyInitOnce?: boolean;
};

export type MockLogs = {
  /** Mocked methods (to access calls etc) */
  mocks: { [k in MockLogMethod]: SpyInstance<typeof console.log> };
  /** Actual console methods */
  realConsole: typeof console;
  /** Re-init the mocks for the current test (to use different options for this test) */
  init: (alsoLog?: boolean | MockLogMethod[]) => void;
  /** Restore mock implementations */
  restore: () => void;
  /** Get the lines logged to a particular method */
  getMockLines: (method: MockLogMethod) => string;
};

/**
 * Initialize console log mocks, which will be reset after each test. This should be called **outside**
 * of any lifecycle hooks or tests because it calls `beforeEach` and `afterEach` for setup and teardown.
 */
export function initMockLogs(options?: MockLogsOptions): MockLogs;
/** @deprecated use object param version */
export function initMockLogs(alsoLog: boolean | MockLogMethod[]): MockLogs;
export function initMockLogs(opts?: MockLogsOptions | boolean | MockLogMethod[]): MockLogs {
  const options = typeof opts === 'boolean' || Array.isArray(opts) ? { alsoLog: opts } : opts || {};
  const { alsoLog, onlyInitOnce } = options;

  const logs: MockLogs = {
    mocks: {} as MockLogs['mocks'],
    realConsole: { ...require('console') },
    init: (shouldLog = alsoLog) => {
      logs.restore(); // clear any previous mocks
      mockedMethods.forEach(method => {
        const shouldLogMethod = typeof shouldLog === 'boolean' ? shouldLog : shouldLog?.includes(method);
        logs.mocks[method] = jest
          .spyOn(console, method)
          .mockImplementation((...args) =>
            shouldLogMethod || process.env.VERBOSE ? logs.realConsole[method](...args) : undefined
          );
      });
    },
    restore: () =>
      Object.entries(logs.mocks).forEach(([name, mock]) => {
        mock.mockRestore();
        delete (logs.mocks as any)[name];
      }),
    getMockLines: method =>
      logs.mocks[method].mock.calls
        .map(args => args.join(' '))
        .join('\n')
        .trim(),
  };

  (onlyInitOnce ? beforeAll : beforeEach)(() => {
    logs.init(alsoLog);
  });

  (onlyInitOnce ? afterAll : afterEach)(() => {
    logs.restore();
  });

  return logs;
}
