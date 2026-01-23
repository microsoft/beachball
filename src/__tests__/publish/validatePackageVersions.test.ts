import { describe, expect, it, jest } from '@jest/globals';
import { validatePackageVersions } from '../../publish/validatePackageVersions';
import type { NpmOptions } from '../../types/NpmOptions';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { initNpmMock } from '../../__fixtures__/mockNpm';
import { makePackageInfos } from '../../__fixtures__/packageInfos';

jest.mock('../../packageManager/npm');
// jest.mock('npm-registry-fetch');

describe('validatePackageVersions', () => {
  const logs = initMockLogs();
  /** Mock the `npm show` command. This also handles cleanup after each test. */
  const npmMock = initNpmMock();
  const npmOptions: NpmOptions = { npmReadConcurrency: 2, path: undefined, registry: 'https://fake' };

  it('succeeds with nothing to validate', async () => {
    expect(await validatePackageVersions([], {}, npmOptions)).toBe(true);
  });

  it('succeeds if package has no versions in the registry', async () => {
    // bar already exists in the registry, but that's fine since it isn't published
    npmMock.setRegistryData({ bar: { versions: ['1.0.0'] } });
    const packageInfos = makePackageInfos({ foo: {}, bar: {} });

    expect(await validatePackageVersions(['foo'], packageInfos, npmOptions)).toBe(true);
    expect(npmMock.mock).toHaveBeenCalledTimes(1);
    // expect(npmMock.mockFetchJson).toHaveBeenCalledTimes(1);
    expect(logs.getMockLines('all')).toMatchInlineSnapshot(`
      "[log]
      Validating new package versions...
      [log]
      Package versions are OK to publish:
        • foo@1.0.0"
    `);
  });

  it('succeeds with valid new versions', async () => {
    // foo already exists in registry
    npmMock.setRegistryData({ foo: { versions: ['0.1.0', '1.0.0', '2.0.0'] } });
    // bar and baz aren't in registry
    const packageInfos = makePackageInfos({ foo: { version: '1.0.1' }, bar: {}, baz: {} });

    // only foo and bar are being published
    expect(await validatePackageVersions(['foo', 'bar'], packageInfos, npmOptions)).toBe(true);
    expect(npmMock.mock).toHaveBeenCalledTimes(2);
    // expect(npmMock.mockFetchJson).toHaveBeenCalledTimes(2);
    expect(logs.getMockLines('all')).toMatchInlineSnapshot(`
      "[log]
      Validating new package versions...
      [log]
      Package versions are OK to publish:
        • foo@1.0.1
        • bar@1.0.0"
    `);
  });

  it('fails with duplicate versions', async () => {
    // foo and bar versions already exist in registry (though bar version is not latest)
    npmMock.setRegistryData({ foo: { versions: ['0.1.0', '1.0.0'] }, bar: { versions: ['1.0.0', '1.1.0'] } });
    // baz and qux aren't in registry
    const packageInfos = makePackageInfos({ foo: {}, bar: {}, baz: {}, qux: {} });

    // foo, bar, baz are attempting publishing
    expect(await validatePackageVersions(['foo', 'bar', 'baz'], packageInfos, npmOptions)).toBe(false);
    expect(npmMock.mock).toHaveBeenCalledTimes(3);
    // expect(npmMock.mockFetchJson).toHaveBeenCalledTimes(3);
    // Multiple error packages are logged, along with the valid package
    expect(logs.getMockLines('all')).toMatchInlineSnapshot(`
      "[log]
      Validating new package versions...
      [log]
      Package versions are OK to publish:
        • baz@1.0.0
      [error]
      ERROR: Attempting to publish package versions that already exist in the registry:
        • bar@1.0.0
        • foo@1.0.0"
    `);
  });
});
