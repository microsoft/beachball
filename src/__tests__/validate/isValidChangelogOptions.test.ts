import { describe, expect, it } from '@jest/globals';
import { isValidChangelogOptions } from '../../validation/isValidChangelogOptions';
import type { ChangelogGroupOptions, ChangelogOptions } from '../../types/ChangelogOptions';
import { initMockLogs } from '../../__fixtures__/mockLogs';

describe('isValidChangelogOptions', () => {
  const logs = initMockLogs();

  it('returns true when options have no groups', () => {
    const options: ChangelogOptions = {};
    expect(isValidChangelogOptions(options)).toBe(true);
    expect(logs.mocks.error).not.toHaveBeenCalled();
  });

  it('returns true when groups are valid with masterPackageName', () => {
    const options = {
      groups: [
        {
          changelogPath: 'path/to/changelog',
          masterPackageName: 'package-name',
          include: ['pkg1', 'pkg2'],
        },
      ],
    } as ChangelogOptions;
    expect(isValidChangelogOptions(options)).toBe(true);
    expect(logs.mocks.error).not.toHaveBeenCalled();
  });

  it('returns true when groups are valid with mainPackageName', () => {
    const options: ChangelogOptions = {
      groups: [
        {
          changelogPath: 'path/to/changelog',
          mainPackageName: 'package-name',
          include: ['pkg1', 'pkg2'],
        },
      ],
    };
    expect(isValidChangelogOptions(options)).toBe(true);
    expect(logs.mocks.error).not.toHaveBeenCalled();
  });

  it('returns false when group is missing changelogPath', () => {
    const options = {
      groups: [
        {
          mainPackageName: 'package-name',
          include: ['pkg1'],
        },
      ],
    } as ChangelogOptions;
    expect(isValidChangelogOptions(options)).toBe(false);
    expect(logs.mocks.error).toHaveBeenCalled();
  });

  it('returns false when group is missing mainPackageName and masterPackageName', () => {
    const options = {
      groups: [
        {
          changelogPath: 'path/to/changelog',
          include: ['pkg1'],
        },
      ],
    } as ChangelogOptions;
    expect(isValidChangelogOptions(options)).toBe(false);
    expect(logs.mocks.error).toHaveBeenCalled();
  });

  it('returns false when group is missing include', () => {
    const options = {
      groups: [
        {
          changelogPath: 'path/to/changelog',
          mainPackageName: 'package-name',
        },
      ],
    } as ChangelogOptions;
    expect(isValidChangelogOptions(options)).toBe(false);
    expect(logs.mocks.error).toHaveBeenCalled();
  });

  it('returns false when multiple groups are invalid', () => {
    const options: ChangelogOptions = {
      groups: [
        {
          changelogPath: 'path/to/changelog',
        } as ChangelogGroupOptions,
        {
          mainPackageName: 'package-name',
        } as ChangelogGroupOptions,
      ],
    };
    expect(isValidChangelogOptions(options)).toBe(false);
    expect(logs.mocks.error).toHaveBeenCalled();
  });

  it('returns false for a mix of valid and invalid groups', () => {
    const options: ChangelogOptions = {
      groups: [
        {
          changelogPath: 'path/to/changelog',
          mainPackageName: 'package-name',
          include: ['pkg1'],
        },
        {
          changelogPath: 'path/to/changelog2',
        } as ChangelogGroupOptions,
      ],
    };
    expect(isValidChangelogOptions(options)).toBe(false);
    expect(logs.mocks.error).toHaveBeenCalled();
  });
});
