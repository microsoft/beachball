import { describe, expect, it } from '@jest/globals';
import { calculatePackageTags, generateTag } from '../../bump/calculatePackageTags';
import { makePackageInfos, type PartialPackageInfos } from '../../__fixtures__/packageInfos';
import type { BumpInfo } from '../../types/BumpInfo';
import type { ChangeType } from '../../types/ChangeInfo';
import type { CliOptions } from '../../types/BeachballOptions';

type CalcParams = Parameters<typeof calculatePackageTags>[0];

describe('generateTag', () => {
  it('formats as name_vversion', () => {
    expect(generateTag('foo', '1.2.3')).toBe('foo_v1.2.3');
  });

  it('formats scoped name and version', () => {
    expect(generateTag('@scope/foo', '1.2.3')).toBe('@scope/foo_v1.2.3');
  });

  it('formats name with prerelease version', () => {
    expect(generateTag('foo', '1.2.3-beta.0')).toBe('foo_v1.2.3-beta.0');
  });
});

describe('calculatePackageTags', () => {
  /**
   * Build a `calculatePackageTags` bump-info input from a partial package info map. By default,
   * every package is considered modified, in-scope, and gets a `patch` change type.
   *
   * Pass `{ [name]: 'none' }` (or omit a name) in `changeTypes` to mark a package as non-bumped.
   */
  function makeCalcParams(
    partialPackageInfos: PartialPackageInfos,
    params?: {
      cliOptions?: Partial<CliOptions>;
      changeTypes?: { [name: string]: ChangeType };
      modified?: string[];
      scoped?: string[];
    }
  ): CalcParams {
    const packageInfos = makePackageInfos(partialPackageInfos, params?.cliOptions);
    const allNames = Object.keys(packageInfos);
    const calculatedChangeTypes: BumpInfo['calculatedChangeTypes'] = Object.fromEntries(
      allNames.map(n => [n, params?.changeTypes?.[n] ?? 'patch'])
    );
    return {
      packageInfos,
      calculatedChangeTypes,
      modifiedPackages: new Set(params?.modified ?? allNames),
      scopedPackages: new Set(params?.scoped ?? allNames),
    };
  }

  it('uses default tag when gitTags is true', () => {
    const params = makeCalcParams({ foo: { version: '1.0.0' }, bar: { version: '2.0.0' } });
    expect(calculatePackageTags(params, { gitTags: true })).toEqual({
      foo: [{ tag: 'foo_v1.0.0' }],
      bar: [{ tag: 'bar_v2.0.0' }],
    });
  });

  it('returns no entries when gitTags is false', () => {
    const params = makeCalcParams({ foo: { version: '1.0.0' } }, { cliOptions: { gitTags: false } });
    expect(calculatePackageTags(params, { gitTags: false })).toEqual({});
  });

  it.each([undefined, '', 'latest', 'beta'])('does not create a git tag for npm dist-tag %p', tag => {
    const params = makeCalcParams({ foo: { version: '1.0.0' } });
    const options = { gitTags: true, tag };
    expect(calculatePackageTags(params, options)).toEqual({
      foo: [{ tag: 'foo_v1.0.0' }],
    });
  });

  it('does not create a git tag for the npm dist-tag without package tags', () => {
    const params = makeCalcParams({});
    const options = { gitTags: true, tag: 'beta' };
    expect(calculatePackageTags(params, options)).toEqual({});
  });

  it('does not create a git tag for the npm dist-tag when getGitTag skips package tags', () => {
    const params = makeCalcParams({ foo: { version: '1.0.0' } });
    const options = { gitTags: true, tag: 'beta', getGitTag: () => null };
    expect(calculatePackageTags(params, options)).toEqual({});
  });

  it('respects per-package gitTags override', () => {
    const params = makeCalcParams({
      foo: { version: '1.0.0', beachball: { gitTags: true } },
      bar: { version: '2.0.0', beachball: { gitTags: false } },
    });
    expect(calculatePackageTags(params, { gitTags: false })).toEqual({
      foo: [{ tag: 'foo_v1.0.0' }],
    });
  });

  it('uses getGitTag to generate custom tags', () => {
    const params = makeCalcParams({ foo: { version: '1.0.0' } });
    const result = calculatePackageTags(params, {
      gitTags: true,
      getGitTag: (_pkg, defaultTag) => `custom-${defaultTag}`,
    });
    expect(result).toEqual({ foo: [{ tag: 'custom-foo_v1.0.0', isCustom: true }] });
  });

  it('uses getGitTag returning multiple tags', () => {
    const params = makeCalcParams({ foo: { version: '2.0.0' } });
    expect(calculatePackageTags(params, { gitTags: true, getGitTag: () => ['tag-a', 'tag-b'] })).toEqual({
      foo: [
        { tag: 'tag-a', isCustom: true },
        { tag: 'tag-b', isCustom: true },
      ],
    });
  });

  it('identifies the default tag among custom tags regardless of its position', () => {
    const params = makeCalcParams({ foo: { version: '2.0.0' } });
    const result = calculatePackageTags(params, {
      gitTags: true,
      getGitTag: (_pkg, defaultTag) => ['primary-tag', defaultTag, 'secondary-tag'],
    });
    expect(result).toEqual({
      foo: [{ tag: 'primary-tag', isCustom: true }, { tag: 'foo_v2.0.0' }, { tag: 'secondary-tag', isCustom: true }],
    });
  });

  it('uses getGitTag returning an empty array to skip tagging', () => {
    const params = makeCalcParams({ foo: { version: '1.0.0' } });
    expect(calculatePackageTags(params, { gitTags: true, getGitTag: () => [] })).toEqual({});
  });

  it('uses getGitTag returning null to skip tagging', () => {
    const params = makeCalcParams({ foo: { version: '1.0.0' } });
    expect(calculatePackageTags(params, { gitTags: true, getGitTag: () => null })).toEqual({});
  });

  it('getGitTag overrides gitTags=false for packages', () => {
    const params = makeCalcParams({ foo: { version: '1.0.0' } }, { cliOptions: { gitTags: false } });
    expect(calculatePackageTags(params, { gitTags: false, getGitTag: (_pkg, defaultTag) => defaultTag })).toEqual({
      foo: [{ tag: 'foo_v1.0.0' }],
    });
  });

  it('skips packages with changeType "none"', () => {
    const params = makeCalcParams(
      { foo: { version: '1.0.0' }, bar: { version: '2.0.0' } },
      { changeTypes: { foo: 'none', bar: 'patch' } }
    );
    expect(calculatePackageTags(params, { gitTags: true })).toEqual({
      bar: [{ tag: 'bar_v2.0.0' }],
    });
  });

  it('skips private packages', () => {
    const params = makeCalcParams({
      foo: { version: '1.0.0', private: true },
      bar: { version: '2.0.0' },
    });
    expect(calculatePackageTags(params, { gitTags: true })).toEqual({
      bar: [{ tag: 'bar_v2.0.0' }],
    });
  });

  it('skips out-of-scope packages', () => {
    const params = makeCalcParams({ foo: { version: '1.0.0' }, bar: { version: '2.0.0' } }, { scoped: ['bar'] });
    expect(calculatePackageTags(params, { gitTags: true })).toEqual({
      bar: [{ tag: 'bar_v2.0.0' }],
    });
  });

  it('skips packages that are not in modifiedPackages', () => {
    const params = makeCalcParams({ foo: { version: '1.0.0' }, bar: { version: '2.0.0' } }, { modified: ['foo'] });
    expect(calculatePackageTags(params, { gitTags: true })).toEqual({
      foo: [{ tag: 'foo_v1.0.0' }],
    });
  });

  it('does not invoke getGitTag for skipped packages', () => {
    const params = makeCalcParams(
      { foo: { version: '1.0.0', private: true }, bar: { version: '2.0.0' } },
      { changeTypes: { foo: 'none', bar: 'patch' } }
    );
    const calls: string[] = [];
    calculatePackageTags(params, {
      gitTags: true,
      getGitTag: pkg => {
        calls.push(pkg.name);
        return null;
      },
    });
    expect(calls).toEqual(['bar']);
  });
});
