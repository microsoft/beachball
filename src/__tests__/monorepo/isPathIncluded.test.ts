import { describe, expect, it } from '@jest/globals';
import { isPathIncluded, makeFileGlobMatcher } from '../../monorepo/isPathIncluded';

describe('isPathIncluded', () => {
  it('returns true if path is included (single include path)', () => {
    expect(isPathIncluded({ relativePath: 'packages/a', include: 'packages/*' })).toBeTruthy();

    if (process.platform === 'win32') {
      expect(isPathIncluded({ relativePath: 'packages\\a', include: 'packages/*' })).toBeTruthy();
    }
  });

  it('returns false if path is not included, with single include path', () => {
    expect(isPathIncluded({ relativePath: 'stuff/b', include: 'packages/*' })).toBeFalsy();
    expect(isPathIncluded({ relativePath: 'packages/b', include: 'packages/!(b)' })).toBeFalsy();
  });

  it('returns false if path is excluded, with single exclude path', () => {
    expect(isPathIncluded({ relativePath: 'packages/a', include: 'packages/*', exclude: 'packages/a' })).toBeFalsy();
  });

  it('returns true if path is included, with multiple include paths', () => {
    expect(
      isPathIncluded({ relativePath: 'packages/a', include: ['packages/b', 'packages/a'], exclude: ['packages/b'] })
    ).toBeTruthy();
  });

  it('returns false if path is excluded, with multiple exclude paths', () => {
    expect(
      isPathIncluded({ relativePath: 'packages/a', include: ['packages/*'], exclude: ['packages/a'] })
    ).toBeFalsy();
  });

  it('returns true if include is true (no exclude paths)', () => {
    expect(isPathIncluded({ relativePath: 'packages/a', include: true })).toBeTruthy();
  });

  it('returns false if include is true and path is excluded', () => {
    expect(isPathIncluded({ relativePath: 'packages/a', include: true, exclude: 'packages/a' })).toBeFalsy();
  });

  it('ignores empty exclude path array', () => {
    expect(isPathIncluded({ relativePath: 'packages/a', include: 'packages/*', exclude: [] })).toBeTruthy();
  });
});

describe('makeFileGlobMatcher', () => {
  it('matches any file with **', () => {
    const matcher = makeFileGlobMatcher('**');
    expect(matcher('foo.js')).toBe(true);
    expect(matcher('src/foo.js')).toBe(true);
    expect(matcher('src/bar/foo.js')).toBe(true);
  });

  it('matches against basename if pattern has no slashes', () => {
    const matcher = makeFileGlobMatcher('*.test.js');
    expect(matcher('foo.js')).toBe(false);
    expect(matcher('foo.test.js')).toBe(true);
    expect(matcher('src/foo.test.js')).toBe(true);
  });

  // Test the workaround for this picomatch bug https://github.com/micromatch/picomatch/issues/136
  it('matches against full path if pattern has slashes', () => {
    const matcher = makeFileGlobMatcher('tests/**');
    expect(matcher('foo.js')).toBe(false);
    expect(matcher('src/foo.js')).toBe(false);
    expect(matcher('tests/foo.js')).toBe(true);
    expect(matcher('tests/bar/foo.js')).toBe(true);

    if (process.platform === 'win32') {
      expect(matcher('tests\\foo.js')).toBe(true);
    }
  });
});
