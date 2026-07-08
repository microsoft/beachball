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
});
