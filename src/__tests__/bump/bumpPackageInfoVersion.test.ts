import { describe, it, expect } from '@jest/globals';
import { bumpPackageInfoVersion } from '../../bump/bumpPackageInfoVersion';
import { makePackageInfos } from '../../__fixtures__/packageInfos';
import type { ChangeType } from '../../types/ChangeInfo';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import type { PackageInfo } from '../../types/PackageInfo';
import type { BeachballOptions } from '../../types/BeachballOptions';

type PartialBumpInfo = Parameters<typeof bumpPackageInfoVersion>[1];

describe('bumpPackageInfoVersion', () => {
  const logs = initMockLogs();
  /** Reused package name */
  const name = 'pkg';

  /**
   * Bump `pkg` (default version `1.0.0`) with given params and return the `bumpInfo`.
   */
  function bumpPackageInfoVersionWrapper(params: {
    /** Extra info (defaults to version 1.0.0), or null for nonexistent package */
    packageInfo?: Partial<PackageInfo> | null;
    changeType: ChangeType | undefined;
    options?: Parameters<typeof bumpPackageInfoVersion>[2];
  }) {
    const { changeType, packageInfo } = params;
    const bumpInfo: PartialBumpInfo = {
      calculatedChangeTypes: changeType ? { [name]: changeType } : {},
      packageInfos: packageInfo === null ? {} : makePackageInfos({ [name]: packageInfo || {} }),
      modifiedPackages: new Set(),
    };

    bumpPackageInfoVersion(name, bumpInfo, params.options || {});

    return bumpInfo;
  }

  it('warns and skips when package info is not found', () => {
    const bumpInfo = bumpPackageInfoVersionWrapper({
      packageInfo: null,
      changeType: 'patch',
    });
    expect(logs.mocks.warn).toHaveBeenCalledWith('Unknown package named "pkg" detected from change files, skipping!');
    expect(bumpInfo.modifiedPackages.size).toBe(0);
  });

  it('warns and skips when no change type is found', () => {
    const bumpInfo = bumpPackageInfoVersionWrapper({
      changeType: undefined,
    });
    expect(logs.mocks.warn).toHaveBeenCalledWith(
      'No change type found when bumping "pkg" (this may be a beachball bug)'
    );
    expect(bumpInfo.packageInfos[name].version).toBe('1.0.0');
    expect(bumpInfo.modifiedPackages.size).toBe(0);
  });

  it('logs and skips when change type is "none"', () => {
    const bumpInfo = bumpPackageInfoVersionWrapper({
      changeType: 'none',
      // prereleasePrefix should be ignored here
      options: { prereleasePrefix: 'beta' },
    });
    expect(logs.mocks.log).toHaveBeenCalledWith('"pkg" has a "none" change type, so no version bump is required.');
    expect(bumpInfo.packageInfos[name].version).toBe('1.0.0');
    expect(bumpInfo.modifiedPackages.size).toBe(0);
  });

  it('warns and skips when package is private', () => {
    const bumpInfo = bumpPackageInfoVersionWrapper({
      changeType: 'patch',
      packageInfo: { private: true },
    });
    expect(logs.mocks.warn).toHaveBeenCalledWith('Skipping bumping private package "pkg"');
    expect(bumpInfo.packageInfos[name].version).toBe('1.0.0');
    expect(bumpInfo.modifiedPackages.size).toBe(0);
  });

  it.each<[ChangeType, string]>([
    ['major', '2.0.0'],
    ['minor', '1.1.0'],
    ['patch', '1.0.1'],
    ['prerelease', '1.0.1-0'],
    ['premajor', '2.0.0-0'],
    ['preminor', '1.1.0-0'],
    ['prepatch', '1.0.1-0'],
  ])('bumps %s version', (changeType, expectedVersion) => {
    const bumpInfo = bumpPackageInfoVersionWrapper({
      changeType,
    });
    expect(bumpInfo.packageInfos[name].version).toBe(expectedVersion);
    expect(bumpInfo.modifiedPackages).toContain(name);
  });

  // This should probably be changed, but documenting it for now
  // https://github.com/microsoft/beachball/issues/1098
  it.each<ChangeType>(['major', 'minor', 'patch'])(
    'bumps as prerelease when prereleasePrefix is set and changeType is %s',
    changeType => {
      const bumpInfo = bumpPackageInfoVersionWrapper({
        changeType,
        options: { prereleasePrefix: 'beta' },
      });
      expect(bumpInfo.packageInfos[name].version).toBe('1.0.1-beta.0');
      expect(bumpInfo.modifiedPackages).toContain(name);
    }
  );

  it.each<[ChangeType, string]>([
    ['prerelease', '1.0.1-beta.0'],
    ['premajor', '2.0.0-beta.0'],
    ['preminor', '1.1.0-beta.0'],
    ['prepatch', '1.0.1-beta.0'],
  ])('uses prereleasePrefix for changeType %s', (changeType, expectedVersion) => {
    const bumpInfo = bumpPackageInfoVersionWrapper({
      changeType,
      options: { prereleasePrefix: 'beta' },
    });
    expect(bumpInfo.packageInfos[name].version).toBe(expectedVersion);
    expect(bumpInfo.modifiedPackages).toContain(name);
  });

  it('bumps to subsequent prerelease version with existing prefix', () => {
    const bumpInfo = bumpPackageInfoVersionWrapper({
      changeType: 'prerelease',
      packageInfo: { version: '1.0.1-beta.2' },
    });
    expect(bumpInfo.packageInfos[name].version).toBe('1.0.1-beta.3');
    expect(bumpInfo.modifiedPackages).toContain(name);
  });

  it.each<[BeachballOptions['identifierBase'], string]>([
    [undefined, '1.0.1-beta.0'], // default
    ['0', '1.0.1-beta.0'],
    ['1', '1.0.1-beta.1'],
    [false, '1.0.1-beta'], // disable numeric identifier
  ])('uses identifierBase %s for prerelease', (identifierBase, expectedVersion) => {
    const bumpInfo = bumpPackageInfoVersionWrapper({
      changeType: 'prerelease',
      options: { identifierBase, prereleasePrefix: 'beta' },
    });
    expect(bumpInfo.packageInfos[name].version).toBe(expectedVersion);
    expect(bumpInfo.modifiedPackages).toContain(name);
  });

  it('uses both prereleasePrefix and identifierBase when provided', () => {
    const bumpInfo = bumpPackageInfoVersionWrapper({
      changeType: 'prerelease',
      options: { prereleasePrefix: 'beta', identifierBase: '1' },
    });
    expect(bumpInfo.packageInfos[name].version).toBe('1.0.1-beta.1');
    expect(bumpInfo.modifiedPackages).toContain(name);
  });

  it('warns and skips if change type is not valid semver', () => {
    const bumpInfo = bumpPackageInfoVersionWrapper({
      changeType: 'invalid-type' as ChangeType,
    });
    expect(logs.mocks.warn).toHaveBeenCalledWith(
      'Invalid version bump requested for "pkg": from version "1.0.0", change type "invalid-type"'
    );
    expect(bumpInfo.packageInfos[name].version).toBe('1.0.0');
    expect(bumpInfo.modifiedPackages.size).toBe(0);
  });

  it('warns and skips if prereleasePrefix is invalid', () => {
    const bumpInfo = bumpPackageInfoVersionWrapper({
      changeType: 'prerelease',
      options: { prereleasePrefix: '!!!' },
    });
    expect(logs.mocks.warn).toHaveBeenCalledWith(
      'Invalid version bump requested for "pkg": from version "1.0.0", change type "prerelease", prerelease prefix "!!!"'
    );
    expect(bumpInfo.packageInfos[name].version).toBe('1.0.0');
    expect(bumpInfo.modifiedPackages.size).toBe(0);
  });

  // documenting semver package behavior
  it('ignores invalid identifierBase', () => {
    const bumpInfo = bumpPackageInfoVersionWrapper({
      changeType: 'prerelease',
      options: { prereleasePrefix: 'beta', identifierBase: 'nope' as BeachballOptions['identifierBase'] },
    });
    expect(logs.mocks.warn).not.toHaveBeenCalled();
    expect(bumpInfo.packageInfos[name].version).toBe('1.0.1-beta.0');
    expect(bumpInfo.modifiedPackages).toContain(name);
  });
});
