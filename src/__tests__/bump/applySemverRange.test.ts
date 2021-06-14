import { applySemverRange } from '../../bump/applySemverRange';

describe('applySemverRange', () => {
  it('applies ^ to semver range', () => {
    const result = applySemverRange('caret', '1.0.0');
    expect(result).toBe('^1.0.0');
  });

  it('applies ~ to semver range', () => {
    const result = applySemverRange('tilde', '1.3.0');
    expect(result).toBe('~1.3.0');
  });

  describe('no-op', () => {
    it('does nothing if range is exact', () => {
      const result = applySemverRange('exact', '0.1.0');
      expect(result).toBe('0.1.0');
    });

    it('does nothing if tilde range is already applied', () => {
      const result = applySemverRange('tilde', '~0.2.0');
      expect(result).toBe('~0.2.0');
    });
  });
});
