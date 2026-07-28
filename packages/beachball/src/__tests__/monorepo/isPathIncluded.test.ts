import { describe, expect, it } from '@jest/globals';
import { isPathIncluded } from '../../monorepo/isPathIncluded';

describe('isPathIncluded', () => {
  it('returns true if path is included (single include path)', () => {
    expect(isPathIncluded({ relativePath: 'packages/a', include: 'packages/*' })).toBeTruthy();
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

  it('returns false if include path is empty', () => {
    expect(isPathIncluded({ relativePath: 'packages/a', include: '' })).toBeFalsy();
  });

  it('ignores empty exclude path array', () => {
    expect(isPathIncluded({ relativePath: 'packages/a', include: 'packages/*', exclude: [] })).toBeTruthy();
  });

  // These document glob behavior that commonly differs between glob libraries/options and should
  // stay consistent if switching implementations. Patterns are anchored to the relative path (no matchBase).
  describe('glob pattern matching', () => {
    it('"packages/*" matches direct children only, not nested paths', () => {
      expect(isPathIncluded({ relativePath: 'packages/a', include: 'packages/*' })).toBeTruthy();
      expect(isPathIncluded({ relativePath: 'packages/a/b', include: 'packages/*' })).toBeFalsy();
    });

    it('"packages/**" matches nested paths but not the "packages" entry itself', () => {
      expect(isPathIncluded({ relativePath: 'packages/a/b', include: 'packages/**' })).toBeTruthy();
      expect(isPathIncluded({ relativePath: 'packages', include: 'packages/**' })).toBeFalsy();
    });

    it('does not match a slashless pattern against the basename (no matchBase)', () => {
      expect(isPathIncluded({ relativePath: 'packages/a', include: 'a' })).toBeFalsy();
    });

    it('supports basic brace expansion', () => {
      expect(isPathIncluded({ relativePath: 'packages/a', include: 'packages/{a,b}' })).toBeTruthy();
      expect(isPathIncluded({ relativePath: 'packages/c', include: 'packages/{a,b}' })).toBeFalsy();
    });

    it('supports character classes', () => {
      expect(isPathIncluded({ relativePath: 'packages/a', include: 'packages/[ab]' })).toBeTruthy();
      expect(isPathIncluded({ relativePath: 'packages/c', include: 'packages/[ab]' })).toBeFalsy();
    });

    it('supports the ? single-character wildcard', () => {
      expect(isPathIncluded({ relativePath: 'packages/a', include: 'packages/?' })).toBeTruthy();
      expect(isPathIncluded({ relativePath: 'packages/ab', include: 'packages/?' })).toBeFalsy();
    });

    it('supports extglob patterns', () => {
      expect(isPathIncluded({ relativePath: 'packages/foofoo', include: 'packages/+(foo)' })).toBeTruthy();
      expect(isPathIncluded({ relativePath: 'packages/a', include: 'packages/!(b)' })).toBeTruthy();
      expect(isPathIncluded({ relativePath: 'packages/b', include: 'packages/!(b)' })).toBeFalsy();
    });

    it('does not traverse dot-directories with **', () => {
      expect(isPathIncluded({ relativePath: 'packages/.hidden/a', include: 'packages/**' })).toBeFalsy();
    });

    it('a trailing-slash pattern does not match a path without one', () => {
      expect(isPathIncluded({ relativePath: 'packages/a', include: 'packages/a/' })).toBeFalsy();
    });

    it('excludes nested paths with a globstar exclude pattern', () => {
      expect(
        isPathIncluded({ relativePath: 'packages/a/b', include: 'packages/**', exclude: 'packages/a/**' })
      ).toBeFalsy();
    });
  });
});
