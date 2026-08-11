import { describe, expect, it, jest } from '@jest/globals';
import { initNpmMock } from '../../__fixtures__/mockNpm';
import { makePackageInfos } from '../../__fixtures__/packageInfos';
import { canary } from '../../commands/canary';
import type { BumpInfo } from '../../types/BumpInfo';
import { getOptions } from '../../options/getOptions';
import { initMockLogs } from '@microsoft/beachball-test-utilities';

jest.mock('../../packageManager/npm');
jest.mock('../../bump/performBump');

describe('canary command', () => {
  initMockLogs();
  const npmMock = initNpmMock();

  it('rechecks only packages whose candidate version already exists', async () => {
    npmMock.setRegistryData({
      foo: { versions: ['1.0.1-canary.0', '1.0.1-canary.1'] },
    });
    const originalPackageInfos = makePackageInfos({ foo: {}, bar: {} });
    const packageInfos = makePackageInfos({ foo: {}, bar: {} });
    const { options } = await getOptions({
      cwd: '',
      argv: ['node', 'beachball', 'canary'],
      env: {},
      testRepoOptions: { registry: 'https://fake', npmReadConcurrency: 1 },
    });
    const scopedPackages = new Set(['foo', 'bar']);
    const bumpInfo: BumpInfo = {
      changeFileChangeInfos: [],
      packageInfos,
      calculatedChangeTypes: {},
      packageGroups: {},
      modifiedPackages: new Set(['foo', 'bar']),
      dependentChangedBy: {},
      scopedPackages,
      packageTags: {},
    };

    await canary(options, { originalPackageInfos, packageGroups: {}, scopedPackages, changeSet: [], bumpInfo });

    expect(packageInfos.foo.version).toBe('1.0.1-canary.2');
    expect(packageInfos.bar.version).toBe('1.0.1-canary.0');
    expect(npmMock.mockFetch.mock.calls.map(([url]) => (url as URL).href)).toEqual([
      'https://fake/foo/1.0.1-canary.0',
      'https://fake/bar/1.0.1-canary.0',
      'https://fake/foo/1.0.1-canary.1',
      'https://fake/foo/1.0.1-canary.2',
    ]);
  });
});
