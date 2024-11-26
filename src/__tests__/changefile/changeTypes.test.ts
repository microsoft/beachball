import { describe, expect, it } from '@jest/globals';
import { getMaxChangeType, initializePackageChangeTypes } from '../../changefile/changeTypes';
import type { ChangeSet } from '../../types/ChangeInfo';
import type { PackageInfo } from '../../types/PackageInfo';

describe('getMaxChangeType', () => {
  it('handles equal change types', () => {
    const changeType = getMaxChangeType('patch', 'patch', null);
    expect(changeType).toBe('patch');
  });

  it('returns greater change type without disallowedChangeTypes', () => {
    expect(getMaxChangeType('patch', 'minor', null)).toBe('minor');
    expect(getMaxChangeType('minor', 'patch', null)).toBe('minor');
    expect(getMaxChangeType('minor', 'major', null)).toBe('major');
    expect(getMaxChangeType('patch', 'major', null)).toBe('major');
    expect(getMaxChangeType('patch', 'prerelease', null)).toBe('patch');
    expect(getMaxChangeType('patch', 'none', null)).toBe('patch');
    expect(getMaxChangeType('prerelease', 'none', null)).toBe('prerelease');
  });

  it('returns none if all given change types are disallowed', () => {
    const changeType = getMaxChangeType('patch', 'major', [
      'major',
      'minor',
      'patch',
      'prerelease',
      'premajor',
      'preminor',
      'prepatch',
    ]);
    expect(changeType).toBe('none');
  });

  it('returns next greatest change type if max is disallowed', () => {
    const changeType = getMaxChangeType('patch', 'major', ['major', 'premajor', 'preminor', 'prepatch']);
    expect(changeType).toBe('minor');
  });

  it('handles prerelease only case', () => {
    const changeType = getMaxChangeType('patch', 'major', [
      'major',
      'minor',
      'patch',
      'premajor',
      'preminor',
      'prepatch',
    ]);
    expect(changeType).toBe('prerelease');
  });
});

describe('initializePackageChangeTypes', () => {
  it('handles an empty change set', () => {
    expect(initializePackageChangeTypes([], {})).toEqual({});
  });

  it('works with a normal change set', () => {
    const changeSet = [
      { change: { packageName: 'foo', type: 'minor' } },
      { change: { packageName: 'bar', type: 'none' } },
      { change: { packageName: 'bar', type: 'minor' } },
      { change: { packageName: 'foo', type: 'patch' } },
      { change: { packageName: 'baz', type: 'none' } },
    ] as ChangeSet;
    expect(
      initializePackageChangeTypes(changeSet, {
        foo: {} as PackageInfo,
        bar: {} as PackageInfo,
        baz: {} as PackageInfo,
      })
    ).toEqual({
      foo: 'minor',
      bar: 'minor',
      baz: 'none',
    });
  });
});
