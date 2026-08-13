import { describe, expect, it } from '@jest/globals';
import { initMockLogs } from '@microsoft/beachball-test-utilities';
import { makeVerboseLogger } from '../helpers.ts';

describe('makeVerboseLogger', () => {
  const logs = initMockLogs();

  it('does not log when verbose logging is disabled', () => {
    const verboseLog = makeVerboseLogger(false);
    expect(verboseLog.verbose).toBe(false);

    verboseLog('message');
    expect(logs.getMockLines('log')).toBe('');
  });

  it('logs messages with the plugin name when enabled', () => {
    const verboseLog = makeVerboseLogger(true);
    expect(verboseLog.verbose).toBe(true);

    verboseLog('first message');
    verboseLog('second message');

    expect(logs.getMockLines('log')).toMatchInlineSnapshot(`
      "[yarn-plugin-npmrc] first message
      [yarn-plugin-npmrc] second message"
    `);
  });

  it('logs a message only once when requested', () => {
    const verboseLog = makeVerboseLogger(true);

    verboseLog('message', true);
    verboseLog('message', true);

    expect(logs.getMockLines('log')).toBe('[yarn-plugin-npmrc] message');
  });
});
