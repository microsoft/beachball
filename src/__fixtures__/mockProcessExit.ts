import { jest } from '@jest/globals';
import type { MockLogs } from './mockLogs';

/**
 * Throw an error when `process.exit()` is called. The message will include any error logs.
 */
export function mockProcessExit(logs: MockLogs): jest.SpiedFunction<typeof process.exit> {
  return jest.spyOn(process, 'exit').mockImplementation(code => {
    throw new Error(`process.exit(${code ?? ''}) called. Logged errors:\n${logs.getMockLines('error')}`);
  });
}
