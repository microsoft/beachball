import { describe, expect, it } from '@jest/globals';
import { isPathIncluded } from '../../monorepo/isPathIncluded';

describe('isPathIncluded', () => {
  it('returns true if path is included (single include path)', () => {
    expect(isPathIncluded('packages/a', 'packages/*')).toBeTruthy();
  });

  it('returns false if path is excluded (single exclude path)', () => {
    expect(isPathIncluded('packages/a', 'packages/*', '!packages/a')).toBeFalsy();
  });

  it('returns true if path is included (multiple include paths)', () => {
    expect(isPathIncluded('packages/a', ['packages/b', 'packages/a'], ['!packages/b'])).toBeTruthy();
  });

  it('returns false if path is excluded (multiple exclude paths)', () => {
    expect(isPathIncluded('packages/a', ['packages/*'], ['!packages/a', '!packages/b'])).toBeFalsy();
  });

  it('returns true if include is true (no exclude paths)', () => {
    expect(isPathIncluded('packages/a', true)).toBeTruthy();
  });

  it('returns false if include is true and path is excluded', () => {
    expect(isPathIncluded('packages/a', true, '!packages/a')).toBeFalsy();
  });

  it('returns false if include path is empty', () => {
    expect(isPathIncluded('packages/a', '')).toBeFalsy();
  });

  it('ignores empty exclude path array', () => {
    expect(isPathIncluded('packages/a', 'packages/*', [])).toBeTruthy();
  });
});
