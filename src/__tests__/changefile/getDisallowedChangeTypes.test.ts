import { describe, expect, it } from '@jest/globals';
import { getDisallowedChangeTypes } from '../../changefile/getDisallowedChangeTypes';
import type { PackageGroups } from '../../types/PackageInfo';
import { makePackageInfos } from '../../__fixtures__/packageInfos';

describe('getDisallowedChangeTypes', () => {
  it('returns null for unknown package', () => {
    expect(getDisallowedChangeTypes('foo', {}, {})).toBeNull();
  });

  it('returns null for package without disallowedChangeTypes', () => {
    expect(getDisallowedChangeTypes('foo', makePackageInfos({ foo: {} }), {})).toBeNull();
  });

  it('returns disallowedChangeTypes for package', () => {
    const packageInfos = makePackageInfos({
      foo: { combinedOptions: { disallowedChangeTypes: ['major', 'minor'] } },
    });
    expect(getDisallowedChangeTypes('foo', packageInfos, {})).toEqual(['major', 'minor']);
  });

  it('returns disallowedChangeTypes for package group', () => {
    const packageInfos = makePackageInfos({ foo: {} });
    const packageGroups: PackageGroups = {
      group: { packageNames: ['foo'], disallowedChangeTypes: ['major', 'minor'] },
    };
    expect(getDisallowedChangeTypes('foo', packageInfos, packageGroups)).toEqual(['major', 'minor']);
  });

  it('returns disallowedChangeTypes for package if not in a group', () => {
    const packageInfos = makePackageInfos({
      foo: { combinedOptions: { disallowedChangeTypes: ['patch'] } },
    });
    const packageGroups: PackageGroups = {
      group: { packageNames: ['bar'], disallowedChangeTypes: ['major', 'minor'] },
    };
    expect(getDisallowedChangeTypes('foo', packageInfos, packageGroups)).toEqual(['patch']);
  });

  it('prefers disallowedChangeTypes for group over package', () => {
    const packageInfos = makePackageInfos({
      foo: { combinedOptions: { disallowedChangeTypes: ['patch'] } },
    });
    const packageGroups: PackageGroups = {
      group: { packageNames: ['foo'], disallowedChangeTypes: ['major', 'minor'] },
    };
    expect(getDisallowedChangeTypes('foo', packageInfos, packageGroups)).toEqual(['major', 'minor']);
  });
});
