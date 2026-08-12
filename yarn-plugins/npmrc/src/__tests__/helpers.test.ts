import { afterEach, describe, expect, it } from '@jest/globals';
import { initMockLogs } from '@microsoft/beachball-test-utilities';
import winPath from 'node:path/win32';
import { fixWindowsPath, makeVerboseLogger } from '../helpers.ts';

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

describe('fixWindowsPath', () => {
  const platformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform');

  afterEach(() => {
    platformDescriptor && Object.defineProperty(process, 'platform', platformDescriptor);
  });

  it('removes the extra leading slash on windows and normalizes path', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });

    expect(fixWindowsPath('/C:/path/to/file')).toBe(winPath.normalize('C:\\path\\to\\file'));
  });

  it('fixes root windows path', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });

    expect(fixWindowsPath('/C:')).toBe(winPath.normalize('C:\\'));
    expect(fixWindowsPath('/C:/')).toBe(winPath.normalize('C:\\'));
  });

  it('leaves paths unchanged on non-Windows platforms', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });

    expect(fixWindowsPath('/C:/path/to/file')).toBe('/C:/path/to/file');
  });
});
