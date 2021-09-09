import { getDisallowedChangeTypes } from '../../changefile/getDisallowedChangeTypes';
import { PackageInfo } from '../../types/PackageInfo';

describe('getDisallowedChangeTypes', () => {
  it('returns null if nothing specified', () => {
    expect(
      getDisallowedChangeTypes('foo', { foo: { combinedOptions: { disallowedChangeTypes: null } } as PackageInfo }, {})
    ).toBeNull();
  });

  it('uses combinedOptions if no group options', () => {
    expect(
      getDisallowedChangeTypes(
        'foo',
        { foo: { combinedOptions: { disallowedChangeTypes: ['major'] } } as PackageInfo },
        {}
      )
    ).toEqual(['major']);
  });

  it('uses combinedOptions if no matching group options', () => {
    expect(
      getDisallowedChangeTypes(
        'foo',
        { foo: { combinedOptions: { disallowedChangeTypes: ['major'] } } as PackageInfo },
        { fooGroup: { packageNames: ['bar'], disallowedChangeTypes: ['prerelease'] } }
      )
    ).toEqual(['major']);
  });

  it('uses group options before combinedOptions', () => {
    expect(
      getDisallowedChangeTypes(
        'foo',
        { foo: { combinedOptions: { disallowedChangeTypes: ['major'] } } as PackageInfo },
        { fooGroup: { packageNames: ['foo'], disallowedChangeTypes: ['prerelease'] } }
      )
    ).toEqual(['prerelease']);
  });

  it('uses correct group for package', () => {
    expect(
      getDisallowedChangeTypes(
        'foo',
        { foo: { combinedOptions: { disallowedChangeTypes: ['major'] } } as PackageInfo },
        {
          barGroup: { packageNames: ['bar'], disallowedChangeTypes: ['patch'] },
          fooGroup: { packageNames: ['foo'], disallowedChangeTypes: ['prerelease'] },
        }
      )
    ).toEqual(['prerelease']);
  });
});
