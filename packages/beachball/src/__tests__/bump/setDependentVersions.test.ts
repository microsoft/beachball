import { describe, it, expect } from '@jest/globals';
import { setDependentVersions } from '../../bump/setDependentVersions';
import { makePackageInfos, type PartialPackageInfos } from '../../__fixtures__/packageInfos';
import { consideredDependencies } from '../../types/PackageInfo';
import { initMockLogs } from '../../__fixtures__/mockLogs';

type PartialBumpInfo = Parameters<typeof setDependentVersions>[0]['bumpInfo'];

describe('setDependentVersions', () => {
  const logs = initMockLogs({ alsoLog: ['warn', 'error'] });

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

  it('returns empty object when no packages are in scope', () => {
    const bumpInfo = makeBumpInfo({
      packageInfos: { 'pkg-a': {} },
      scopedPackages: new Set(),
      // not sure if this would be included if out of scope, but check in case
      modifiedPackages: new Set(['pkg-a']),
    });

    const result = setDependentVersions({ bumpInfo, options: {} });

    expect(result).toEqual({});
  });

  it('returns empty object when no packages are modified', () => {
    const bumpInfo = makeBumpInfo({
      packageInfos: { 'pkg-a': {} },
      modifiedPackages: new Set(),
    });

    const result = setDependentVersions({ bumpInfo, options: {} });

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

    const result = setDependentVersions({ bumpInfo, options: {} });

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

    const result = setDependentVersions({ bumpInfo, options: {} });

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

    const result = setDependentVersions({ bumpInfo, options: {} });

    expect(bumpInfo.packageInfos['pkg-b'][depType]!['pkg-a']).toBe('^1.1.0');
    expect(result).toEqual({ 'pkg-b': new Set(['pkg-a']) });

    // doesn't log by default
    expect(logs.mocks.log).not.toHaveBeenCalled();
  });

  it('handles (ignores) external dependencies', () => {
    const bumpInfo = makeBumpInfo({
      packageInfos: {
        'pkg-a': { version: '1.0.0', dependencies: { external: '^1.0.0' } },
      },
    });

    const result = setDependentVersions({ bumpInfo, options: {} });

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

    const result = setDependentVersions({ bumpInfo, options: {} });

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

    setDependentVersions({ bumpInfo, options: { verbose: true } });

    expect(logs.mocks.log).toHaveBeenCalledWith('pkg-b needs to be bumped because pkg-a ^1.0.0 -> ^2.0.0');
  });

  // https://github.com/microsoft/beachball/issues/981
  it.each(['workspace:*', 'workspace:^', 'workspace:~'])(
    'records dependent bumps for %s ranges (range string unchanged)',
    workspaceVersion => {
      const bumpInfo = makeBumpInfo({
        packageInfos: {
          'pkg-a': { version: '1.1.0' },
          'pkg-b': { version: '1.0.1', dependencies: { 'pkg-a': workspaceVersion } },
        },
      });

      const result = setDependentVersions({ bumpInfo, options: {} });

      expect(bumpInfo.packageInfos['pkg-b'].dependencies!['pkg-a']).toBe(workspaceVersion);
      expect(result).toEqual({ 'pkg-b': new Set(['pkg-a']) });
    }
  );

  // https://github.com/microsoft/beachball/issues/981
  it.each(['catalog:', 'catalog:foo'])(
    'records dependent bumps for %s ranges (range string unchanged)',
    catalogVersion => {
      const bumpInfo = makeBumpInfo({
        packageInfos: {
          'pkg-a': { version: '1.1.0' },
          'pkg-b': { version: '1.0.1', dependencies: { 'pkg-a': catalogVersion } },
        },
      });

      const result = setDependentVersions({ bumpInfo, options: {} });

      expect(bumpInfo.packageInfos['pkg-b'].dependencies!['pkg-a']).toBe(catalogVersion);
      expect(result).toEqual({ 'pkg-b': new Set(['pkg-a']) });
    }
  );

  // file: deps are intentionally excluded — see #1080
  it('does not record dependent bumps for file: ranges', () => {
    const bumpInfo = makeBumpInfo({
      packageInfos: {
        'pkg-a': { version: '1.1.0' },
        'pkg-b': { version: '1.0.1', dependencies: { 'pkg-a': 'file:../pkg-a' } },
      },
    });

    const result = setDependentVersions({ bumpInfo, options: {} });

    expect(bumpInfo.packageInfos['pkg-b'].dependencies!['pkg-a']).toBe('file:../pkg-a');
    expect(result).toEqual({});
  });

  it('does not record dependent bumps for workspace:/catalog: with skipImplicitBumps: true', () => {
    const bumpInfo = makeBumpInfo({
      packageInfos: {
        'pkg-a': { version: '1.1.0' },
        'pkg-b': { version: '1.0.1', dependencies: { 'pkg-a': 'workspace:*' } },
        'pkg-c': { version: '1.0.1', dependencies: { 'pkg-a': 'catalog:foo' } },
      },
    });

    const result = setDependentVersions({ bumpInfo, options: {}, skipImplicitBumps: true });

    expect(bumpInfo.packageInfos['pkg-b'].dependencies!['pkg-a']).toBe('workspace:*');
    expect(bumpInfo.packageInfos['pkg-c'].dependencies!['pkg-a']).toBe('catalog:foo');
    expect(result).toEqual({});
  });

  it('logs a different verbose message when the range is unchanged', () => {
    const bumpInfo = makeBumpInfo({
      packageInfos: {
        'pkg-a': { version: '1.1.0' },
        'pkg-b': { version: '1.0.1', dependencies: { 'pkg-a': 'workspace:*' } },
      },
    });

    setDependentVersions({ bumpInfo, options: { verbose: true } });

    expect(logs.mocks.log).toHaveBeenCalledWith(
      'pkg-b needs a changelog entry because pkg-a was bumped to 1.1.0 (range workspace:* unchanged)'
    );
  });
});
