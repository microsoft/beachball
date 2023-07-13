import { afterEach, describe, expect, it, jest } from '@jest/globals';
import _ from 'lodash';
import { _clearPackageVersionsCache } from '../../packageManager/listPackageVersions';
import { getNewPackages } from '../../publish/getNewPackages';
import { NpmOptions } from '../../types/NpmOptions';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { initNpmMock } from '../../__fixtures__/mockNpm';
import { makePackageInfos } from '../../__fixtures__/packageInfos';

jest.mock('../../packageManager/npm');

describe('getNewPackages', () => {
  const logs = initMockLogs();
  /** Mock the `npm show` command for `npmAsync` calls. This also handles cleanup after each test. */
  const npmMock = initNpmMock();
  const npmOptions = {} as NpmOptions;

  afterEach(() => {
    _clearPackageVersionsCache();
  });

  it('returns empty if no packages exist', async () => {
    const newPackages = await getNewPackages({ modifiedPackages: new Set(), packageInfos: {} }, npmOptions);
    expect(newPackages).toEqual([]);
    expect(npmMock.spy).not.toHaveBeenCalled();
    expect(logs.mocks.log).not.toHaveBeenCalled();
  });

  it('returns empty if all packages are modified not new', async () => {
    const modifiedPackages = new Set(['foo', 'bar']);
    const packageInfos = makePackageInfos({ foo: {}, bar: {} });

    const newPackages = await getNewPackages({ modifiedPackages, packageInfos }, npmOptions);
    expect(newPackages).toEqual([]);
    expect(npmMock.spy).not.toHaveBeenCalled();
    expect(logs.mocks.log).not.toHaveBeenCalled();
  });

  it('returns empty if no packages are new', async () => {
    // foo and bar aren't modified locally but already exist in the registry
    npmMock.setShowData({ foo: { versions: ['1.0.0'] }, bar: { versions: ['1.0.0'] } });
    const modifiedPackages = new Set<string>();
    const packageInfos = makePackageInfos({ foo: {}, bar: {} });

    const newPackages = await getNewPackages({ modifiedPackages, packageInfos }, npmOptions);
    expect(newPackages).toEqual([]);
    expect(npmMock.spy).toHaveBeenCalledTimes(2);
    expect(logs.mocks.log).not.toHaveBeenCalled();
  });

  it('returns new packages with no modified packagess', async () => {
    npmMock.setShowData({});
    const modifiedPackages = new Set<string>();
    const packageInfos = makePackageInfos({ foo: {}, bar: {} });

    const newPackages = await getNewPackages({ modifiedPackages, packageInfos }, npmOptions);
    expect(newPackages).toEqual(['foo', 'bar']);
    expect(npmMock.spy).toHaveBeenCalledTimes(2);
    expect(logs.mocks.log).toHaveBeenCalledTimes(2);
    expect(logs.mocks.log).toHaveBeenCalledWith('New package detected: foo');
    expect(logs.mocks.log).toHaveBeenCalledWith('New package detected: bar');
  });

  it('returns only new package with mix of new, old, and modified', async () => {
    npmMock.setShowData({ foo: { versions: ['1.0.0'] } });
    const modifiedPackages = new Set<string>(['bar']);
    const packageInfos = makePackageInfos({ foo: {}, bar: {}, baz: {} });

    const newPackages = await getNewPackages({ modifiedPackages, packageInfos }, npmOptions);
    expect(newPackages).toEqual(['baz']);
    expect(npmMock.spy).toHaveBeenCalledTimes(2);
    expect(logs.mocks.log).toHaveBeenCalledTimes(1);
    expect(logs.mocks.log).toHaveBeenCalledWith('New package detected: baz');
  });
});
