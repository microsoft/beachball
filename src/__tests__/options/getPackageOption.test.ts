import { describe, expect, it } from '@jest/globals';
import { getPackageOption } from '../../options/getPackageOption';
import { getDefaultOptions } from '../../options/getDefaultOptions';

type PartialPackageInfo = Parameters<typeof getPackageOption>[1];
type PartialBeachballOptions = Parameters<typeof getPackageOption>[2];

describe('getPackageOption', () => {
  it('returns package-specific option when set to string', () => {
    const packageInfo: PartialPackageInfo = { packageOptions: { tag: 'beta' } };
    const options: PartialBeachballOptions = { ...getDefaultOptions(), tag: 'latest' };

    expect(getPackageOption('tag', packageInfo, options)).toBe('beta');
  });

  it('returns package-specific option when set to false', () => {
    const packageInfo: PartialPackageInfo = { packageOptions: { gitTags: false } };
    const options: PartialBeachballOptions = { ...getDefaultOptions(), gitTags: true };

    expect(getPackageOption('gitTags', packageInfo, options)).toBe(false);
  });

  it('returns package-specific option when set to null', () => {
    const packageInfo: PartialPackageInfo = { packageOptions: { disallowedChangeTypes: null } };
    const options: PartialBeachballOptions = { ...getDefaultOptions(), disallowedChangeTypes: ['major'] };

    expect(getPackageOption('disallowedChangeTypes', packageInfo, options)).toBe(null);
  });

  it('falls back to main option when package option is undefined', () => {
    const packageInfo: PartialPackageInfo = { packageOptions: {} };
    const options: PartialBeachballOptions = { ...getDefaultOptions(), gitTags: true };

    expect(getPackageOption('gitTags', packageInfo, options)).toBe(true);
  });

  it('falls back to main option when packageOptions is undefined', () => {
    const options: PartialBeachballOptions = { ...getDefaultOptions(), gitTags: false };

    expect(getPackageOption('gitTags', {}, options)).toBe(false);
  });
});
