import { describe, expect, it } from '@jest/globals';
import { calculatePackageTags, generateTag } from '../../bump/calculatePackageTags';
import { makePackageInfos } from '../../__fixtures__/packageInfos';

describe('generateTag', () => {
  it('formats as name_vversion', () => {
    expect(generateTag('foo', '1.2.3')).toBe('foo_v1.2.3');
  });

  it('formats scoped name and version', () => {
    // no special logic
    expect(generateTag('@scope/foo', '1.2.3')).toBe('@scope/foo_v1.2.3');
  });

  it('formats name with prerelease version', () => {
    expect(generateTag('foo', '1.2.3-beta.0')).toBe('foo_v1.2.3-beta.0');
  });
});

describe('calculatePackageTags', () => {
  it('uses default tag when gitTags is true', () => {
    const packageInfos = makePackageInfos({ foo: { version: '1.0.0' }, bar: { version: '2.0.0' } });
    const result = calculatePackageTags({ packageInfos }, { gitTags: true });
    expect(result).toEqual({ foo: ['foo_v1.0.0'], bar: ['bar_v2.0.0'] });
  });

  it('returns undefined entries when gitTags is false', () => {
    const packageInfos = makePackageInfos({ foo: { version: '1.0.0' } }, { gitTags: false });
    const result = calculatePackageTags({ packageInfos }, { gitTags: false });
    expect(result).toEqual({});
  });

  it('respects per-package gitTags override', () => {
    const packageInfos = makePackageInfos({
      foo: { version: '1.0.0', beachball: { gitTags: true } },
      bar: { version: '2.0.0', beachball: { gitTags: false } },
    });
    const result = calculatePackageTags({ packageInfos }, { gitTags: false });
    expect(result).toEqual({ foo: ['foo_v1.0.0'] });
  });

  it('uses getGitTag to generate custom tags', () => {
    const packageInfos = makePackageInfos({ foo: { version: '1.0.0' } });
    const result = calculatePackageTags(
      { packageInfos },
      { gitTags: true, getGitTag: (_pkg, defaultTag) => `custom-${defaultTag}` }
    );
    expect(result).toEqual({ foo: ['custom-foo_v1.0.0'] });
  });

  it('uses getGitTag returning multiple tags', () => {
    const packageInfos = makePackageInfos({ foo: { version: '2.0.0' } });
    const result = calculatePackageTags({ packageInfos }, { gitTags: true, getGitTag: () => ['tag-a', 'tag-b'] });
    expect(result).toEqual({ foo: ['tag-a', 'tag-b'] });
  });

  it('uses getGitTag returning null to skip tagging', () => {
    const packageInfos = makePackageInfos({ foo: { version: '1.0.0' } });
    const result = calculatePackageTags({ packageInfos }, { gitTags: true, getGitTag: () => null });
    expect(result).toEqual({});
  });

  it('getGitTag overrides gitTags=false for packages', () => {
    const packageInfos = makePackageInfos({ foo: { version: '1.0.0' } }, { gitTags: false });
    const result = calculatePackageTags(
      { packageInfos },
      { gitTags: false, getGitTag: (_pkg, defaultTag) => defaultTag }
    );
    expect(result).toEqual({ foo: ['foo_v1.0.0'] });
  });
});
