import { describe, it, expect } from '@jest/globals';
import { makePackageInfos, type PartialPackageInfos } from '../../__fixtures__/packageInfos';
import { getPackagesToPublish } from '../../publish/getPackagesToPublish';
import { initMockLogs } from '../../__fixtures__/mockLogs';

type PartialBumpInfo = Parameters<typeof getPackagesToPublish>[0];

describe('getPackagesToPublish', () => {
  const logs = initMockLogs();

  /**
   * Fill the bump info and call `getPackagesToPublish`. Defaults:
   * - all packages are in scope and modified
   * - all modified packages have changeType: 'patch'
   * - logging enabled
   */
  function getPackagesToPublishWrapper(
    partialBumpInfo: { packageInfos: PartialPackageInfos } & Partial<Omit<PartialBumpInfo, 'packageInfos'>>,
    params?: Parameters<typeof getPackagesToPublish>[1]
  ) {
    const { packageInfos, modifiedPackages = new Set(Object.keys(packageInfos)), ...rest } = partialBumpInfo;
    const bumpInfo: PartialBumpInfo = {
      packageInfos: makePackageInfos(packageInfos),
      modifiedPackages,
      scopedPackages: new Set(Object.keys(packageInfos)),
      calculatedChangeTypes: Object.fromEntries([...modifiedPackages].map(pkg => [pkg, 'patch'])),
      ...rest,
    };
    return getPackagesToPublish(bumpInfo, { logSkipped: true, ...params });
  }

  it('returns empty if no modified packages', () => {
    const result = getPackagesToPublishWrapper({
      packageInfos: { 'pkg-a': {}, 'pkg-b': {} },
      modifiedPackages: new Set(),
    });
    expect(result).toEqual([]);
    expect(logs.mocks.log).not.toHaveBeenCalled();
  });

  it('includes modified packages', () => {
    const result = getPackagesToPublishWrapper({
      packageInfos: { 'pkg-a': {}, 'pkg-b': {}, 'pkg-c': {}, 'pkg-d': { private: true } },
      modifiedPackages: new Set(['pkg-a', 'pkg-c']),
    });
    expect(result).toEqual(['pkg-a', 'pkg-c']);
    expect(logs.mocks.log).not.toHaveBeenCalled();
  });

  it('excludes private packages', () => {
    const result = getPackagesToPublishWrapper({
      packageInfos: { 'pkg-a': { private: true }, 'pkg-b': { private: true }, 'pkg-c': {} },
    });
    expect(result).toEqual(['pkg-c']);
    expect(logs.getMockLines('log')).toMatchInlineSnapshot(`
      "Skipping publishing the following packages:
        • pkg-a is private
        • pkg-b is private"
    `);
  });

  it('excludes packages with change type "none"', () => {
    const result = getPackagesToPublishWrapper({
      packageInfos: { 'pkg-a': {}, 'pkg-b': {}, 'pkg-c': {} },
      modifiedPackages: new Set(['pkg-a', 'pkg-c']),
      calculatedChangeTypes: { 'pkg-a': 'none', 'pkg-c': 'major' },
    });
    expect(result).toEqual(['pkg-c']);
    expect(logs.getMockLines('log')).toMatchInlineSnapshot(`
      "Skipping publishing the following packages:
        • pkg-a has change type none"
    `);
  });

  it('excludes out of scope packages', () => {
    const result = getPackagesToPublishWrapper({
      packageInfos: { 'pkg-a': {}, 'pkg-b': {} },
      scopedPackages: new Set(['pkg-a']),
    });
    expect(result).toEqual(['pkg-a']);
    expect(logs.getMockLines('log')).toMatchInlineSnapshot(`
      "Skipping publishing the following packages:
        • pkg-b is out-of-scope"
    `);
  });

  it('includes new packages even with no change type', () => {
    const result = getPackagesToPublishWrapper({
      packageInfos: { 'pkg-a': {}, 'pkg-b': {}, 'pkg-c': {} },
      modifiedPackages: new Set(['pkg-a']),
      newPackages: ['pkg-b'],
      calculatedChangeTypes: { 'pkg-a': 'patch' },
    });
    expect(result.sort()).toEqual(['pkg-a', 'pkg-b']);
    expect(logs.mocks.log).not.toHaveBeenCalled();
  });

  it('excludes out of scope new packages', () => {
    const result = getPackagesToPublishWrapper({
      packageInfos: { 'pkg-a': {}, 'pkg-b': {} },
      modifiedPackages: new Set(),
      newPackages: ['pkg-b'],
      scopedPackages: new Set(['pkg-a']),
    });
    expect(result).toEqual([]);
    expect(logs.getMockLines('log')).toMatchInlineSnapshot(`
      "Skipping publishing the following packages:
        • pkg-b is out-of-scope"
    `);
  });

  // This happens for reasons outlined in https://github.com/microsoft/beachball/issues/1123
  it('excludes packages without calculated change type', () => {
    const result = getPackagesToPublishWrapper({
      packageInfos: { 'pkg-a': {}, 'pkg-b': {} },
      modifiedPackages: new Set(['pkg-a', 'pkg-b']),
      calculatedChangeTypes: { 'pkg-a': 'patch' },
    });
    expect(result).toEqual(['pkg-a']);
    expect(logs.getMockLines('log')).toMatchInlineSnapshot(`
      "Skipping publishing the following packages:
        • pkg-b is not bumped (no calculated change type)"
    `);
  });
});
