export type MockLogs = {
  /** Mocked methods (to access calls etc). More could be added later if needed. */
  mocks: { [k in 'log' | 'warn' | 'error']: jest.SpyInstance<void, Parameters<typeof console.log>> };
  /** Actual console methods */
  realConsole: typeof console;
  /** Re-init the mocks (you only need to manually call this after resetting or restoring mocks) */
  init: (alsoLog?: boolean) => void;
  /** Clear mock results */
  clear: () => void;
  /** Restore mock implementations */
  restore: () => void;
};

/**
 * Initialize console log mocks, which will be cleared (but not reset) after each test.
 * This should be called **outside** of any lifecycle hooks or tests because it calls `beforeAll`,
 * `afterEach`, and `afterAll` for setup and teardown.
 * @param alsoLog Whether to also log to the real console. Can be controlled by VERBOSE env var.
 */
export function initMockLogs(alsoLog: boolean = !!process.env.VERBOSE): MockLogs {
  const mock = (method: 'log' | 'warn' | 'error', shouldLog: boolean) => {
    logs.mocks[method] = jest
      .spyOn(console, method)
      .mockImplementation((...args) => (shouldLog ? realConsole[method](...args) : undefined));
  };

  const realConsole = { ...console };
  const logs: MockLogs = {
    mocks: {} as MockLogs['mocks'],
    realConsole,
    init: (shouldLog = alsoLog) => (['log', 'warn', 'error'] as const).forEach(method => mock(method, shouldLog)),
    clear: () => Object.values(logs.mocks).forEach(mock => mock.mockClear()),
    restore: () => Object.values(logs.mocks).forEach(mock => mock.mockRestore()),
  };

  beforeAll(() => {
    logs.init(alsoLog);
  });

  afterEach(() => {
    logs.clear();
  });

  afterAll(() => {
    logs.restore();
  });

  return logs;
}
