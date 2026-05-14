import { describe, expect, it } from '@jest/globals';
import { isPackageIncluded } from '../../changefile/isPackageIncluded';
import { makePackageInfos } from '../../__fixtures__/packageInfos';

describe('isPackageIncluded', () => {
  it('excludes when packageInfo is undefined (not found)', () => {
    expect(isPackageIncluded(undefined, new Set(['foo']))).toEqual({
      isIncluded: false,
      reason: 'no corresponding package found',
    });
  });

  it('excludes private packages', () => {
    const { foo } = makePackageInfos({ foo: { private: true } });
    expect(isPackageIncluded(foo, new Set(['foo']))).toEqual({
      isIncluded: false,
      reason: 'foo is private',
    });
  });

  it('excludes packages out of scope', () => {
    const { foo } = makePackageInfos({ foo: {} });
    expect(isPackageIncluded(foo, new Set(['bar']))).toEqual({
      isIncluded: false,
      reason: 'foo is out of scope',
    });
  });

  it('includes packages that pass all checks', () => {
    const { foo } = makePackageInfos({ foo: {} });
    expect(isPackageIncluded(foo, new Set(['foo']))).toEqual({
      isIncluded: true,
      reason: '',
    });
  });

  it('reports private before out-of-scope', () => {
    const { foo } = makePackageInfos({ foo: { private: true } });
    expect(isPackageIncluded(foo, new Set(['bar']))).toEqual({
      isIncluded: false,
      reason: 'foo is private',
    });
  });
});
