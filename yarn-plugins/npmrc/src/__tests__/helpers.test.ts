import { afterEach, describe, expect, it } from '@jest/globals';
import winPath from 'node:path/win32';
import { fixWindowsPath } from '../helpers.ts';

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

    expect(fixWindowsPath('/C:')).toBe(winPath.normalize('C:'));
    expect(fixWindowsPath('/C:/')).toBe(winPath.normalize('C:\\'));
  });

  it('leaves paths unchanged on non-Windows platforms', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });

    expect(fixWindowsPath('/C:/path/to/file')).toBe('/C:/path/to/file');
  });
});
