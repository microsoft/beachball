import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { _clearPackageVersionsCache } from '../../packageManager/listPackageVersions';
import { validatePackageVersions } from '../../publish/validatePackageVersions';
import { NpmOptions } from '../../types/NpmOptions';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { initNpmAsyncMock } from '../../__fixtures__/mockNpm';
import { makePackageInfos } from '../../__fixtures__/packageInfos';

jest.mock('../../packageManager/npm');

describe('validatePackageVersions', () => {
  const logs = initMockLogs();
  /** Mock the `npm show` command for `npmAsync` calls. This also handles cleanup after each test. */
  const npmMock = initNpmAsyncMock();
  const npmOptions = {} as NpmOptions;

  afterEach(() => {
    _clearPackageVersionsCache();
  });

  it('succeeds with nothing to validate', async () => {
    expect(await validatePackageVersions([], {}, npmOptions)).toBe(true);
  });

  it('succeeds with a valid new version', async () => {
    npmMock.setShowData({ foo: { versions: ['0.1.0', '1.0.0', '2.0.0'] } });
    const packageInfos = makePackageInfos({ foo: { version: '1.0.1' } });

    expect(await validatePackageVersions(['foo'], packageInfos, npmOptions)).toBe(true);
    expect(npmMock.spy).toHaveBeenCalledTimes(1);
    expect(logs.getMockLines('all')).toMatchInlineSnapshot(`
      "[log]
      Validating new package versions...
      [log]
      Package versions are OK to publish:
      - foo@1.0.1"
    `);
  });

  it('succeeds if package has no versions in the registry', async () => {
    npmMock.setShowData({});
    const packageInfos = makePackageInfos({ foo: { version: '1.0.0' } });

    expect(await validatePackageVersions(['foo'], packageInfos, npmOptions)).toBe(true);
    expect(npmMock.spy).toHaveBeenCalledTimes(1);
    expect(logs.getMockLines('all')).toMatchInlineSnapshot(`
      "[log]
      Validating new package versions...
      [log]
      Package versions are OK to publish:
      - foo@1.0.0"
    `);
  });

  it('fails with a duplicate version', async () => {
    npmMock.setShowData({ foo: { versions: ['0.1.0', '1.0.0'] } });
    const packageInfos = makePackageInfos({ foo: { version: '1.0.0' } });

    expect(await validatePackageVersions(['foo'], packageInfos, npmOptions)).toBe(false);
    expect(npmMock.spy).toHaveBeenCalledTimes(1);
    expect(logs.getMockLines('error')).toMatchInlineSnapshot(`
      "ERROR: Attempting to publish package versions that already exist in the registry:
      - foo@1.0.0"
    `);
  });

  it('fails with useful output if both valid and invalid versions are present', async () => {
    npmMock.setShowData({ foo: { versions: ['1.0.0'] }, bar: { versions: ['1.0.0'] } });
    const packageInfos = makePackageInfos({ foo: { version: '1.0.0' }, bar: { version: '1.0.1' } });

    expect(await validatePackageVersions(['foo', 'bar'], packageInfos, npmOptions)).toBe(false);
    expect(npmMock.spy).toHaveBeenCalledTimes(2);
    expect(logs.getMockLines('all')).toMatchInlineSnapshot(`
      "[log]
      Validating new package versions...
      [log]
      Package versions are OK to publish:
      - bar@1.0.1
      [error]
      ERROR: Attempting to publish package versions that already exist in the registry:
      - foo@1.0.0"
    `);
  });
});
