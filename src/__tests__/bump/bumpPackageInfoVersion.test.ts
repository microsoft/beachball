import { describe, it, expect, jest, afterEach, beforeAll, afterAll } from '@jest/globals';
import { bumpPackageInfoVersion } from '../../bump/bumpPackageInfoVersion';
import { makePackageInfos } from '../../__fixtures__/packageInfos';
import type { ChangeType } from '../../types/ChangeInfo';

type PartialBumpInfo = Parameters<typeof bumpPackageInfoVersion>[1];

describe('bumpPackageInfoVersion', () => {
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;

  beforeAll(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('logs and skips when package info is not found', () => {
    const bumpInfo: PartialBumpInfo = {
      calculatedChangeTypes: { 'pkg-a': 'patch' },
      packageInfos: {},
      modifiedPackages: new Set<string>(),
    };

    bumpPackageInfoVersion('pkg-a', bumpInfo, {});

    expect(consoleLogSpy).toHaveBeenCalledWith('Unknown package named "pkg-a" detected from change files, skipping!');
    expect(bumpInfo.modifiedPackages.size).toBe(0);
  });

  it('logs and skips when change type is "none"', () => {
    const bumpInfo: PartialBumpInfo = {
      calculatedChangeTypes: { 'pkg-a': 'none' },
      packageInfos: makePackageInfos({ 'pkg-a': { version: '1.0.0' } }),
      modifiedPackages: new Set<string>(),
    };

    // prereleasePrefix should be ignored here
    bumpPackageInfoVersion('pkg-a', bumpInfo, { prereleasePrefix: 'beta' });

    expect(consoleLogSpy).toHaveBeenCalledWith('"pkg-a" has a "none" change type, no version bump is required.');
    expect(bumpInfo.packageInfos['pkg-a'].version).toBe('1.0.0');
    expect(bumpInfo.modifiedPackages.size).toBe(0);
  });

  it('logs and skips when package is private', () => {
    const bumpInfo: PartialBumpInfo = {
      calculatedChangeTypes: { 'pkg-a': 'patch' },
      packageInfos: makePackageInfos({ 'pkg-a': { version: '1.0.0', private: true } }),
      modifiedPackages: new Set<string>(),
    };

    bumpPackageInfoVersion('pkg-a', bumpInfo, {});

    expect(consoleLogSpy).toHaveBeenCalledWith('Skipping bumping private package "pkg-a"');
    expect(bumpInfo.packageInfos['pkg-a'].version).toBe('1.0.0');
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
    const bumpInfo: PartialBumpInfo = {
      calculatedChangeTypes: { 'pkg-a': changeType },
      packageInfos: makePackageInfos({ 'pkg-a': { version: '1.0.0' } }),
      modifiedPackages: new Set<string>(),
    };

    bumpPackageInfoVersion('pkg-a', bumpInfo, {});

    expect(bumpInfo.packageInfos['pkg-a'].version).toBe(expectedVersion);
    expect(bumpInfo.modifiedPackages).toContain('pkg-a');
  });

  // This should probably be changed, but documenting it for now
  // https://github.com/microsoft/beachball/issues/1098
  it.each<ChangeType>(['major', 'minor', 'patch'])(
    'bumps as prerelease when prereleasePrefix is set and changeType is %s',
    changeType => {
      const bumpInfo: PartialBumpInfo = {
        calculatedChangeTypes: { 'pkg-a': changeType },
        packageInfos: makePackageInfos({ 'pkg-a': { version: '1.0.0' } }),
        modifiedPackages: new Set<string>(),
      };

      bumpPackageInfoVersion('pkg-a', bumpInfo, { prereleasePrefix: 'beta' });

      expect(bumpInfo.packageInfos['pkg-a'].version).toBe('1.0.1-beta.0');
      expect(bumpInfo.modifiedPackages).toContain('pkg-a');
    }
  );

  it.each<[ChangeType, string]>([
    ['prerelease', '1.0.1-beta.0'],
    ['premajor', '2.0.0-beta.0'],
    ['preminor', '1.1.0-beta.0'],
    ['prepatch', '1.0.1-beta.0'],
  ])('uses prereleasePrefix for changeType %s', (changeType, expectedVersion) => {
    const bumpInfo: PartialBumpInfo = {
      calculatedChangeTypes: { 'pkg-a': changeType },
      packageInfos: makePackageInfos({ 'pkg-a': { version: '1.0.0' } }),
      modifiedPackages: new Set<string>(),
    };

    bumpPackageInfoVersion('pkg-a', bumpInfo, { prereleasePrefix: 'beta' });

    expect(bumpInfo.packageInfos['pkg-a'].version).toBe(expectedVersion);
    expect(bumpInfo.modifiedPackages).toContain('pkg-a');
  });

  it('uses identifierBase for prerelease when provided', () => {
    const bumpInfo: PartialBumpInfo = {
      calculatedChangeTypes: { 'pkg-a': 'prerelease' },
      packageInfos: makePackageInfos({ 'pkg-a': { version: '1.0.0' } }),
      modifiedPackages: new Set<string>(),
    };

    bumpPackageInfoVersion('pkg-a', bumpInfo, { identifierBase: '1' });

    expect(bumpInfo.packageInfos['pkg-a'].version).toBe('1.0.1-1');
    expect(bumpInfo.modifiedPackages).toContain('pkg-a');
  });

  it('uses both prereleasePrefix and identifierBase when provided', () => {
    const bumpInfo: PartialBumpInfo = {
      calculatedChangeTypes: { 'pkg-a': 'prerelease' },
      packageInfos: makePackageInfos({ 'pkg-a': { version: '1.0.0' } }),
      modifiedPackages: new Set<string>(),
    };

    bumpPackageInfoVersion('pkg-a', bumpInfo, { prereleasePrefix: 'beta', identifierBase: '1' });

    expect(bumpInfo.packageInfos['pkg-a'].version).toBe('1.0.1-beta.1');
    expect(bumpInfo.modifiedPackages).toContain('pkg-a');
  });
});
