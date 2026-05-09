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

  it('returns false for groups with masterPackageName', () => {
    const options = {
      groups: [
        {
          changelogPath: 'path/to/changelog',
          masterPackageName: 'package-name',
          include: ['pkg1', 'pkg2'],
        },
      ],
    } as unknown as ChangelogOptions;
    expect(isValidChangelogOptions(options)).toBe(false);
    expect(logs.getMockLines('error')).toMatchInlineSnapshot(`
      "ERROR: "changelog.groups[*].masterPackageName" is renamed to "mainPackageName" in v3. Invalid groups:
        • masterPackageName "package-name""
    `);
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

  it('returns false when exclude patterns start with "!"', () => {
    const options: ChangelogOptions = {
      // these groups don't make sense in combination; just test that the ones with bad exclude patterns are caught
      groups: [
        { changelogPath: 'path', mainPackageName: 'pkg', include: true, exclude: ['ok', '!invalid-array'] },
        { changelogPath: 'path2', mainPackageName: 'pkg2', include: true, exclude: '!invalid-string' },
        { changelogPath: 'path3', mainPackageName: 'pkg3', include: true, exclude: ['ok', 'also-ok'] },
      ],
    };
    expect(isValidChangelogOptions(options)).toBe(false);
    expect(logs.getMockLines('error')).toMatchInlineSnapshot(`
      "ERROR: "changelog.groups[*].exclude" patterns must not start with "!" in v3. Found invalid groups:
        • mainPackageName "pkg": [ "ok", "!invalid-array" ]
        • mainPackageName "pkg2": "!invalid-string""
    `);
  });
});
