type ConsoleLogSpy = jest.SpyInstance<void, Parameters<typeof console['log']>>;

export interface LogMocks {
  log: ConsoleLogSpy;
  warn: ConsoleLogSpy;
  error: ConsoleLogSpy;
  /** Whether to actually display logs on the console (default false) */
  enabled: boolean;
  /** Any logged messages */
  messages: Array<readonly ['log' | 'warn' | 'error', string]>;
  /** Restore the original console function implementations */
  restore: () => void;
}

/**
 * Spy on `console.log/warn/error` and prevent logs from displaying unless `result.enabled` is true.
 * Returns an object for monitoring and managing the log mocks.
 */
export function mockLogs(): LogMocks {
  const getLogMock = (logType: 'log' | 'warn' | 'error') => {
    const realLog = console[logType];
    return jest.spyOn(console, logType).mockImplementation((...args: any[]) => {
      result.messages.push([logType, args.join(' ')] as const);
      result.enabled && realLog(...args);
    });
  };

  const result: LogMocks = {
    enabled: false,
    messages: [],
    log: getLogMock('log'),
    warn: getLogMock('warn'),
    error: getLogMock('error'),
    restore: () => {
      result.log.mockRestore();
      result.warn.mockRestore();
      result.error.mockRestore();
    },
  };
  return result;
}
