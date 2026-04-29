import { describe, it, expect } from '@jest/globals';
import { bumpPackageInfoVersion } from '../../bump/bumpPackageInfoVersion';
import { makePackageInfos } from '../../__fixtures__/packageInfos';
import type { ChangeType } from '../../types/ChangeInfo';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import type { PackageInfo } from '../../types/PackageInfo';

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
  }) {
    const { changeType, packageInfo } = params;
    const bumpInfo: PartialBumpInfo = {
      calculatedChangeTypes: changeType ? { [name]: changeType } : {},
      packageInfos: packageInfo === null ? {} : makePackageInfos({ [name]: packageInfo || {} }),
      modifiedPackages: new Set(),
    };

    bumpPackageInfoVersion(name, bumpInfo);

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
  ])('bumps %s version', (changeType, expectedVersion) => {
    const bumpInfo = bumpPackageInfoVersionWrapper({
      changeType,
    });
    expect(bumpInfo.packageInfos[name].version).toBe(expectedVersion);
    expect(bumpInfo.modifiedPackages).toContain(name);
  });

  // The publish/bump prerelease -> release promotion case (assumption E in the design):
  // If the current version has a prerelease component, it's stripped before applying the
  // bump, so the user gets the intuitive "release" version after a prerelease cycle.
  it.each<[string, ChangeType, string]>([
    ['1.0.0-beta.0', 'patch', '1.0.1'],
    ['1.0.0-beta.0', 'minor', '1.1.0'],
    ['1.0.0-beta.0', 'major', '2.0.0'],
    ['1.0.1-beta.5', 'patch', '1.0.2'],
    ['0.2.0-beta.0', 'minor', '0.3.0'],
  ])('strips prerelease component before bumping (%s + %s -> %s)', (currentVersion, changeType, expectedVersion) => {
    const bumpInfo = bumpPackageInfoVersionWrapper({
      changeType,
      packageInfo: { version: currentVersion },
    });
    expect(bumpInfo.packageInfos[name].version).toBe(expectedVersion);
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
});
