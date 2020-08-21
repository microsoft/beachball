import { isPathIncluded } from '../../monorepo/utils';

describe('isPathIncluded', () => {
  it('should return true if path is included with single include path', () => {
    expect(isPathIncluded('packages/a', 'packages/*')).toBeTruthy();
  });

  it('should return false if path is excluded with single exclude path', () => {
    expect(isPathIncluded('packages/a', 'packages/*', '!packages/a')).toBeFalsy();
  });

  it('should return true if path is included with multiple include paths', () => {
    expect(isPathIncluded('packages/a', ['packages/b', 'packages/a'], ['!packages/b'])).toBeTruthy();
  });

  it('should return false if path is excluded with multiple exclude paths', () => {
    expect(isPathIncluded('packages/a', ['packages/*'], ['!packages/a'])).toBeFalsy();
  });

  it('should return false if include path is empty', () => {
    expect(isPathIncluded('packages/a', '')).toBeFalsy();
  });
});
