import { describe, expect, it } from '@jest/globals';
import { initMockLogs } from '@microsoft/beachball-test-utilities';
import type { ChangelogGroupOptions, ChangelogOptions } from '../../types/ChangelogOptions';
import { isValidChangelogOptions } from '../../validation/isValidChangelogOptions';

describe('isValidChangelogOptions', () => {
  const logs = initMockLogs();

  it('returns true when options have no groups', () => {
    const options: ChangelogOptions = {};
    expect(isValidChangelogOptions(options)).toBe(true);
    expect(logs.mocks.error).not.toHaveBeenCalled();
  });

  it('returns true when groups are valid', () => {
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
    expect(logs.getMockLines('error')).toMatchInlineSnapshot(`
      "ERROR: "changelog.groups" entries must define "changelogPath", "mainPackageName", and "include". Invalid groups:
        • { "mainPackageName": "package-name", "include": ["pkg1"] }"
    `);
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
    expect(logs.getMockLines('error')).toMatchInlineSnapshot(`
      "ERROR: "changelog.groups" entries must define "changelogPath", "mainPackageName", and "include". Invalid groups:
        • { "changelogPath": "path/to/changelog" }
        • { "mainPackageName": "package-name" }"
    `);
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
    expect(logs.getMockLines('error')).toMatchInlineSnapshot(`
      "ERROR: "changelog.groups" entries must define "changelogPath", "mainPackageName", and "include". Invalid groups:
        • { "changelogPath": "path/to/changelog2" }"
    `);
  });
});
