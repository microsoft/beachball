import { isValidDependentChangeType } from '../../validation/isValidDependentChangeType';

describe('isValidDependentChangeType', () => {
  it('accepts valid change types', () => {
    expect(isValidDependentChangeType('major', null)).toBe(true);
    expect(isValidDependentChangeType('minor', null)).toBe(true);
    expect(isValidDependentChangeType('patch', null)).toBe(true);
    expect(isValidDependentChangeType('prerelease', null)).toBe(true);
    expect(isValidDependentChangeType('none', null)).toBe(true);
  });

  it('rejects completely invalid change types', () => {
    expect(isValidDependentChangeType('nope' as any, null)).toBe(false);
  });

  it('respects disallowedChangeTypes', () => {
    expect(isValidDependentChangeType('major', ['major', 'prerelease'])).toBe(false);
  });

  it('always allows patch changes', () => {
    // Patch must always be allowed as dependentChangeType even if the package only allows
    // prerelease changes. It will be downgraded to prerelease if appropriate when bumping.
    expect(isValidDependentChangeType('patch', ['major', 'minor', 'patch'])).toBe(true);
  });
});
