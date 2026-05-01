import { describe, expect, it } from '@jest/globals';
import { getPrereleaseVersion } from '../../bump/getPrereleaseVersion';

describe('getPrereleaseVersion', () => {
  it('uses identifierBase 0 by default when no matching versions exist', () => {
    expect(
      getPrereleaseVersion({
        currentVersion: '1.0.0',
        changeType: 'patch',
        prereleasePrefix: 'beta',
        existingVersions: [],
      })
    ).toBe('1.0.1-beta.0');
  });

  it('uses identifierBase "1" when no matching versions exist', () => {
    expect(
      getPrereleaseVersion({
        currentVersion: '1.0.0',
        changeType: 'patch',
        prereleasePrefix: 'beta',
        identifierBase: '1',
        existingVersions: [],
      })
    ).toBe('1.0.1-beta.1');
  });

  it('omits the numeric counter with identifierBase: false', () => {
    expect(
      getPrereleaseVersion({
        currentVersion: '1.0.0',
        changeType: 'patch',
        prereleasePrefix: 'beta',
        identifierBase: false,
        existingVersions: [],
      })
    ).toBe('1.0.1-beta');
  });

  it('errors with identifierBase: false if the resulting version already exists', () => {
    expect(() =>
      getPrereleaseVersion({
        currentVersion: '1.0.0',
        changeType: 'patch',
        prereleasePrefix: 'beta',
        identifierBase: false,
        existingVersions: ['1.0.1-beta'],
      })
    ).toThrow(/already exists/);
  });

  it.each([
    ['1.0.0', 'patch' as const, '1.0.1-beta.0'],
    ['1.0.0', 'minor' as const, '1.1.0-beta.0'],
    ['1.0.0', 'major' as const, '2.0.0-beta.0'],
    ['1.0.0', 'none' as const, '1.0.0-beta.0'],
  ])('applies change type %s to %s -> %s', (currentVersion, changeType, expected) => {
    expect(
      getPrereleaseVersion({
        currentVersion,
        changeType,
        prereleasePrefix: 'beta',
        existingVersions: [],
      })
    ).toBe(expected);
  });

  it('strips an existing prerelease component from the current version before bumping', () => {
    // This is the fix for issue #676: 0.2.0-beta.0 + minor change should produce 0.3.0-beta.0,
    // not 0.2.1-beta.0 (which is what naive `semver.inc(v, 'minor')` on the prerelease would do).
    expect(
      getPrereleaseVersion({
        currentVersion: '0.2.0-beta.0',
        changeType: 'minor',
        prereleasePrefix: 'beta',
        existingVersions: [],
      })
    ).toBe('0.3.0-beta.0');
  });

  it('finds the next counter when matching versions exist', () => {
    expect(
      getPrereleaseVersion({
        currentVersion: '1.0.0',
        changeType: 'patch',
        prereleasePrefix: 'beta',
        existingVersions: ['1.0.1-beta.0', '1.0.1-beta.1', '1.0.1-beta.2'],
      })
    ).toBe('1.0.1-beta.3');
  });

  it('handles non-contiguous existing counters', () => {
    expect(
      getPrereleaseVersion({
        currentVersion: '1.0.0',
        changeType: 'patch',
        prereleasePrefix: 'beta',
        existingVersions: ['1.0.1-beta.0', '1.0.1-beta.5', '1.0.1-beta.2'],
      })
    ).toBe('1.0.1-beta.6');
  });

  it('ignores existing versions for unrelated targets', () => {
    expect(
      getPrereleaseVersion({
        currentVersion: '1.0.0',
        changeType: 'minor',
        prereleasePrefix: 'beta',
        existingVersions: ['1.0.1-beta.0', '1.0.1-beta.1', '0.9.0-beta.0'],
      })
    ).toBe('1.1.0-beta.0');
  });

  it('ignores existing versions with a different prefix', () => {
    expect(
      getPrereleaseVersion({
        currentVersion: '1.0.0',
        changeType: 'patch',
        prereleasePrefix: 'beta',
        existingVersions: ['1.0.1-canary.0', '1.0.1-alpha.5'],
      })
    ).toBe('1.0.1-beta.0');
  });

  it('ignores existing versions with non-numeric or compound suffixes', () => {
    expect(
      getPrereleaseVersion({
        currentVersion: '1.0.0',
        changeType: 'patch',
        prereleasePrefix: 'beta',
        existingVersions: ['1.0.1-beta', '1.0.1-beta.0.extra', '1.0.1-beta.abc'],
      })
    ).toBe('1.0.1-beta.0');
  });

  it('throws when prereleasePrefix is empty', () => {
    expect(() =>
      getPrereleaseVersion({
        currentVersion: '1.0.0',
        changeType: 'patch',
        prereleasePrefix: '',
        existingVersions: [],
      })
    ).toThrow(/prereleasePrefix is required/);
  });
});
