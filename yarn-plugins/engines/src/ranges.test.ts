import semver from 'semver';
import { describe, it, expect } from '@jest/globals';
import { parseRange, isRangeSatisfied } from './ranges.js';

describe('parseRange', () => {
  it.each([undefined, null, '', 'invalid'])('returns null for invalid range: %s', input => {
    expect(parseRange(input)).toBeNull();
  });

  it.each(['14.0.0', '>=14.0.0', '^14.0.0', '~14.0.0', '>=14.0.0 <15.0.0', '^14.0.0 || >=16.0.0'])(
    'returns a semver.Range object for valid range: %s',
    input => {
      const range = parseRange(input);
      expect(range).toBeInstanceOf(semver.Range);
      expect(range?.range).toBeTruthy();
    }
  );

  it('returns a semver.Range object for *', () => {
    const range = parseRange('*');
    expect(range).toBeInstanceOf(semver.Range);
    // This one has special handling internally for some reason
    expect(range?.range).toBe('');
    expect(range?.raw).toBe('*');
  });
});

describe('isRangeSatisfied', () => {
  it('returns true if the manifest range is invalid', () => {
    expect(isRangeSatisfied({ repoRange: '>=14.0.0', manifestRange: null })).toBe(true);
    expect(isRangeSatisfied({ repoRange: '>=14.0.0', manifestRange: undefined })).toBe(true);
    expect(isRangeSatisfied({ repoRange: '>=14.0.0', manifestRange: 'invalid' })).toBe(true);
    expect(isRangeSatisfied({ repoRange: '>=14.0.0', manifestRange: '' })).toBe(true);
  });

  const overlapCases = [
    { repoRange: '>=14.0.0', manifestRange: '>=12.0.0' },
    { repoRange: '^14.0.0', manifestRange: '>=14.0.0' },
    { repoRange: '14', manifestRange: '>=14.0.0' },
    { repoRange: '^14.2.0', manifestRange: '^14.1.0 || >=16' },
    { repoRange: '^14.2.0', manifestRange: '*' },
  ];

  it('returns true if the repo range overlaps the manifest range (loose: false)', () => {
    for (const { repoRange, manifestRange } of overlapCases) {
      expect(isRangeSatisfied({ repoRange, manifestRange })).toBe(true);
    }
  });

  it('returns true if the repo range overlaps the manifest range (loose: true)', () => {
    for (const { repoRange, manifestRange } of overlapCases) {
      expect(isRangeSatisfied({ repoRange, manifestRange, loose: true })).toBe(true);
    }
  });

  it('returns false if the repo range is lower than the manifest range', () => {
    const repoRange = '>=14.0.0';
    const manifestRange = '>=16.0.0';
    expect(isRangeSatisfied({ repoRange, manifestRange })).toBe(false);
    expect(isRangeSatisfied({ repoRange, manifestRange, loose: true })).toBe(false);
  });

  it('returns false if the repo range is higher than the manifest range', () => {
    const repoRange = '^14.0.0';
    const manifestRange = '>=12.0.0 <14.0.0';
    expect(isRangeSatisfied({ repoRange, manifestRange })).toBe(false);
    expect(isRangeSatisfied({ repoRange, manifestRange, loose: true })).toBe(false);
  });

  it('returns false if the repo range falls between multiple manifest ranges', () => {
    const repoRange = '^14.2.0';
    const manifestRange = '^12.0.0 || >=14.3.0';
    expect(isRangeSatisfied({ repoRange, manifestRange })).toBe(false);
    expect(isRangeSatisfied({ repoRange, manifestRange, loose: true })).toBe(false);
  });

  const partialOverlapCases = [
    { repoRange: '>=14.0.0', manifestRange: '>=12.0.0 <14.5.0' },
    { repoRange: '^14.0.0', manifestRange: '>=12.0.0 <14.5.0' },
    // repo accepts 21, manifest does not
    { repoRange: '>=20.17.0', manifestRange: '^20.17.0 || >=22.9.0' },
  ];

  it('returns false if the repo range only partially overlaps the manifest range (loose: false)', () => {
    for (const { repoRange, manifestRange } of partialOverlapCases) {
      expect(isRangeSatisfied({ repoRange, manifestRange })).toBe(false);
    }
  });

  it('with loose: true, returns true if the lower end of the repo range overlaps the manifest range', () => {
    for (const { repoRange, manifestRange } of partialOverlapCases) {
      expect(isRangeSatisfied({ repoRange, manifestRange, loose: true })).toBe(true);
    }
  });
});
