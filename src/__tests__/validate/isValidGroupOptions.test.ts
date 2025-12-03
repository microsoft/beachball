import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { isValidGroupOptions, isValidGroupedPackageOptions } from '../../validation/isValidGroupOptions';
import type { VersionGroupOptions } from '../../types/BeachballOptions';
import type { PackageGroups } from '../../types/PackageInfo';
import { makePackageInfos } from '../../__fixtures__/packageInfos';

describe('isValidGroupOptions', () => {
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeAll(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('returns true for valid groups', () => {
    const groups: VersionGroupOptions[] = [
      { name: 'group1', include: ['pkg1', 'pkg2'], disallowedChangeTypes: null },
      { name: 'group2', include: ['pkg3'], disallowedChangeTypes: null },
    ];
    expect(isValidGroupOptions(groups)).toBe(true);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('returns false when groups is not an array', () => {
    const groups = { name: 'group1', include: ['pkg1'] };
    expect(isValidGroupOptions(groups as any)).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy.mock.calls[0].join(' ')).toMatchInlineSnapshot(`
      "ERROR: Expected "groups" configuration setting to be an array. Received:
      { "name": "group1", "include": ["pkg1"] }"
    `);
  });

  it('returns false when a group is missing name', () => {
    const groups = [{ include: ['pkg1'] }] as VersionGroupOptions[];
    expect(isValidGroupOptions(groups)).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy.mock.calls[0].join(' ')).toMatchInlineSnapshot(`
      "ERROR: "groups" configuration entries must define "include" and "name". Found invalid groups:
        • { "include": ["pkg1"] }"
    `);
  });

  it('returns false when a group is missing include', () => {
    const groups = [{ name: 'group1' }] as VersionGroupOptions[];
    expect(isValidGroupOptions(groups)).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('must define "include" and "name"'));
  });

  it('returns false when multiple groups are invalid', () => {
    const groups: VersionGroupOptions[] = [
      { name: 'ok', include: ['pkg2'], disallowedChangeTypes: null },
      { name: 'group1' } as VersionGroupOptions,
      { include: ['pkg1'] } as VersionGroupOptions,
      { name: 'ok2', include: ['pkg3'], disallowedChangeTypes: null },
    ];
    expect(isValidGroupOptions(groups)).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy.mock.calls[0].join(' ')).toMatchInlineSnapshot(`
      "ERROR: "groups" configuration entries must define "include" and "name". Found invalid groups:
        • { "name": "group1" }
        • { "include": ["pkg1"] }"
    `);
  });
});

describe('isValidGroupedPackageOptions', () => {
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeAll(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('returns true when no packages have disallowedChangeTypes', () => {
    const packageInfos = makePackageInfos({ pkg1: {}, pkg2: {} });
    const packageGroups: PackageGroups = {
      group1: { packageNames: ['pkg1', 'pkg2'], disallowedChangeTypes: null },
    };
    expect(isValidGroupedPackageOptions(packageInfos, packageGroups)).toBe(true);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('returns false when a grouped package has disallowedChangeTypes', () => {
    const packageInfos = makePackageInfos({
      pkg1: { beachball: { disallowedChangeTypes: ['major'] } },
      pkg2: {},
    });
    const packageGroups: PackageGroups = {
      group1: { packageNames: ['pkg1', 'pkg2'], disallowedChangeTypes: null },
    };
    expect(isValidGroupedPackageOptions(packageInfos, packageGroups)).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy.mock.calls[0].join(' ')).toMatchInlineSnapshot(`
      "ERROR: Found package configs that define disallowedChangeTypes and are also part of a group. Define disallowedChangeTypes in the group instead.
        • pkg1 in group "group1""
    `);
  });

  it('returns false when multiple grouped packages have disallowedChangeTypes', () => {
    const packageInfos = makePackageInfos({
      pkg1: { beachball: { disallowedChangeTypes: ['major'] } },
      pkg2: { beachball: { disallowedChangeTypes: ['minor'] } },
      pkg3: {},
    });
    const packageGroups: PackageGroups = {
      group1: { packageNames: ['pkg1', 'pkg2', 'pkg3'], disallowedChangeTypes: null },
    };
    expect(isValidGroupedPackageOptions(packageInfos, packageGroups)).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy.mock.calls[0].join(' ')).toMatchInlineSnapshot(`
      "ERROR: Found package configs that define disallowedChangeTypes and are also part of a group. Define disallowedChangeTypes in the group instead.
        • pkg1 in group "group1"
        • pkg2 in group "group1""
    `);
  });

  it('handles multiple groups', () => {
    const packageInfos = makePackageInfos({
      pkg1: { beachball: { disallowedChangeTypes: ['major'] } },
      pkg2: {},
      pkg3: {},
      pkg4: {},
    });
    const packageGroups: PackageGroups = {
      group1: { packageNames: ['pkg1'], disallowedChangeTypes: null },
      group2: { packageNames: ['pkg2', 'pkg3'], disallowedChangeTypes: null },
      group3: { packageNames: ['pkg4'], disallowedChangeTypes: null },
    };
    expect(isValidGroupedPackageOptions(packageInfos, packageGroups)).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy.mock.calls[0].join(' ')).toMatchInlineSnapshot(`
      "ERROR: Found package configs that define disallowedChangeTypes and are also part of a group. Define disallowedChangeTypes in the group instead.
        • pkg1 in group "group1""
    `);
  });
});
