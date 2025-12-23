import { describe, it, expect, afterEach, jest, beforeAll, afterAll } from '@jest/globals';
import { setDependentVersions } from '../../bump/setDependentVersions';
import { makePackageInfos, type PartialPackageInfos } from '../../__fixtures__/packageInfos';
import { consideredDependencies } from '../../types/PackageInfo';

type PartialBumpInfo = Parameters<typeof setDependentVersions>[0];

describe('setDependentVersions', () => {
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;

  /**
   * Make the bump info. Package versions should reflect any bumps applied.
   *
   * Unless otherwise specified, assumes all packages are in scope and have been modified.
   * Realistically this would have been determined based on change types and `dependentChangeTypes`.
   */
  function makeBumpInfo(
    params: { packageInfos: PartialPackageInfos } & Partial<Omit<PartialBumpInfo, 'packageInfos'>>
  ): PartialBumpInfo {
    const { packageInfos, ...rest } = params;
    return {
      packageInfos: makePackageInfos(packageInfos),
      scopedPackages: new Set(Object.keys(packageInfos)),
      modifiedPackages: new Set(Object.keys(packageInfos)),
      ...rest,
    };
  }

  beforeAll(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('returns empty object when no packages are in scope', () => {
    const bumpInfo = makeBumpInfo({
      packageInfos: { 'pkg-a': {} },
      scopedPackages: new Set(),
      // not sure if this would be included if out of scope, but check in case
      modifiedPackages: new Set(['pkg-a']),
    });

    const result = setDependentVersions(bumpInfo, {});

    expect(result).toEqual({});
  });

  it('returns empty object when no packages are modified', () => {
    const bumpInfo = makeBumpInfo({
      packageInfos: { 'pkg-a': {} },
      modifiedPackages: new Set(),
    });

    const result = setDependentVersions(bumpInfo, {});

    expect(result).toEqual({});
  });

  it('bumps dependency version range when dependency is bumped to unsatisfied range', () => {
    const bumpInfo = makeBumpInfo({
      packageInfos: {
        // assume this had change type major
        'pkg-a': { version: '2.0.0' },
        // and this would be bumped for dependentChangeType patch
        'pkg-b': { version: '1.0.1', dependencies: { 'pkg-a': '^1.0.0' } },
      },
    });

    const result = setDependentVersions(bumpInfo, {});

    expect(bumpInfo.packageInfos['pkg-b'].dependencies!['pkg-a']).toBe('^2.0.0');
    expect(result).toEqual({ 'pkg-b': new Set(['pkg-a']) });
  });

  it('bumps dependency range even if already satisfied', () => {
    const bumpInfo = makeBumpInfo({
      packageInfos: {
        // assume this had change type minor
        'pkg-a': { version: '1.1.0' },
        // and this would be bumped for dependentChangeType patch
        'pkg-b': { version: '1.0.1', dependencies: { 'pkg-a': '^1.0.0' } },
        'pkg-c': { version: '1.0.1', dependencies: { 'pkg-a': '~1.0.0' } },
      },
    });

    const result = setDependentVersions(bumpInfo, {});

    expect(bumpInfo.packageInfos['pkg-b'].dependencies!['pkg-a']).toBe('^1.1.0');
    expect(bumpInfo.packageInfos['pkg-c'].dependencies!['pkg-a']).toBe('~1.1.0');
    expect(result).toEqual({ 'pkg-b': new Set(['pkg-a']), 'pkg-c': new Set(['pkg-a']) });
  });

  it.each(consideredDependencies)('handles %s', depType => {
    const bumpInfo = makeBumpInfo({
      packageInfos: {
        'pkg-a': { version: '1.1.0' },
        'pkg-b': { version: '1.0.1', [depType]: { 'pkg-a': '^1.0.0' } },
      },
    });

    const result = setDependentVersions(bumpInfo, {});

    expect(bumpInfo.packageInfos['pkg-b'][depType]!['pkg-a']).toBe('^1.1.0');
    expect(result).toEqual({ 'pkg-b': new Set(['pkg-a']) });

    // doesn't log by default
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it('handles (ignores) external dependencies', () => {
    const bumpInfo = makeBumpInfo({
      packageInfos: {
        'pkg-a': { version: '1.0.0', dependencies: { external: '^1.0.0' } },
      },
    });

    const result = setDependentVersions(bumpInfo, {});

    expect(bumpInfo.packageInfos['pkg-a'].dependencies!['external']).toBe('^1.0.0');
    expect(result).toEqual({});
  });

  it('handles multiple dependencies being bumped', () => {
    const bumpInfo = makeBumpInfo({
      packageInfos: {
        'pkg-a': { version: '1.0.1' },
        'pkg-b': { version: '1.1.0' },
        'pkg-c': { version: '1.0.1', dependencies: { 'pkg-a': '^1.0.0' }, peerDependencies: { 'pkg-b': '^1.0.0' } },
      },
    });

    const result = setDependentVersions(bumpInfo, {});

    expect(bumpInfo.packageInfos['pkg-c'].dependencies!['pkg-a']).toBe('^1.0.1');
    expect(bumpInfo.packageInfos['pkg-c'].peerDependencies!['pkg-b']).toBe('^1.1.0');
    expect(result).toEqual({ 'pkg-c': new Set(['pkg-a', 'pkg-b']) });
  });

  it('logs when verbose is true', () => {
    const bumpInfo = makeBumpInfo({
      packageInfos: {
        'pkg-a': { version: '2.0.0' },
        'pkg-b': { version: '1.0.1', dependencies: { 'pkg-a': '^1.0.0' } },
      },
    });

    setDependentVersions(bumpInfo, { verbose: true });

    expect(consoleLogSpy).toHaveBeenCalledWith('pkg-b needs to be bumped because pkg-a ^1.0.0 -> ^2.0.0');
  });

  // Documenting this issue
  // https://github.com/microsoft/beachball/issues/981
  it('currently misses bumps of workspace: ranges', () => {
    const bumpInfo = makeBumpInfo({
      packageInfos: {
        'pkg-a': { version: '1.1.0' },
        // * means an exact dependency and should definitely cause a bump
        'pkg-b': { version: '1.0.1', dependencies: { 'pkg-a': 'workspace:*' } },
      },
    });

    const result = setDependentVersions(bumpInfo, {});

    expect(bumpInfo.packageInfos['pkg-b'].dependencies!['pkg-a']).toBe('workspace:*');
    expect(result).toEqual({}); // should have pkg-b depending on pkg-a
  });

  // Documenting this issue
  // https://github.com/microsoft/beachball/issues/981
  it('currently misses bumps of catalog: ranges', () => {
    const bumpInfo = makeBumpInfo({
      packageInfos: {
        'pkg-a': { version: '1.1.0' },
        // Assume there's a catalog like this:
        // catalog:
        //   pkg-a: ^1.1.0
        'pkg-b': { version: '1.0.1', dependencies: { 'pkg-a': 'catalog:' } },
      },
    });

    const result = setDependentVersions(bumpInfo, {});

    expect(bumpInfo.packageInfos['pkg-b'].dependencies!['pkg-a']).toBe('catalog:');
    expect(result).toEqual({}); // should have pkg-b depending on pkg-a
  });
});
