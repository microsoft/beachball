import { afterEach, describe, expect, it, jest } from '@jest/globals';
import _ from 'lodash';
import {
  listPackageVersions,
  listPackageVersionsByTag,
  _clearPackageVersionsCache,
  npmShowProperties,
} from '../../packageManager/listPackageVersions';
import type { NpmOptions } from '../../types/NpmOptions';
import { initNpmMock } from '../../__fixtures__/mockNpm';
import { makePackageInfos } from '../../__fixtures__/packageInfos';

jest.mock('../../packageManager/npm');

describe('list npm versions', () => {
  /** Mock the `npm show` command for `npmAsync` calls. This also handles cleanup after each test. */
  const npmMock = initNpmMock();
  const npmOptions: NpmOptions = { registry: 'https://fake', path: undefined };
  const commonArgs = ['show', '--registry', 'https://fake', '--json'];

  afterEach(() => {
    _clearPackageVersionsCache();
  });

  describe('listPackageVersions', () => {
    it('succeeds with nothing to do', async () => {
      const versions = await listPackageVersions([], npmOptions);
      expect(versions).toEqual({});
      expect(npmMock.mock).not.toHaveBeenCalled();
    });

    it('returns versions for one package', async () => {
      npmMock.setRegistryData({ foo: { versions: ['1.0.0', '1.0.1'] } });
      const versions = await listPackageVersions(['foo'], npmOptions);
      expect(versions).toEqual({ foo: ['1.0.0', '1.0.1'] });
      expect(npmMock.mock).toHaveBeenCalledTimes(1);
      expect(npmMock.mock).toHaveBeenCalledWith([...commonArgs, 'foo', ...npmShowProperties], expect.anything());
    });

    it('returns empty versions array for missing package', async () => {
      npmMock.setRegistryData({});
      const versions = await listPackageVersions(['foo'], npmOptions);
      expect(versions).toEqual({ foo: [] });
      expect(npmMock.mock).toHaveBeenCalledTimes(1);
      expect(npmMock.mock).toHaveBeenCalledWith([...commonArgs, 'foo', ...npmShowProperties], expect.anything());
    });

    it('returns versions for multiple packages', async () => {
      const packages = 'abcdefghij'.split('');
      const showData = Object.fromEntries(packages.map((x, i) => [x, { versions: [`${i}.0.0`, `${i}.0.1`] }]));
      npmMock.setRegistryData(showData);

      const versions = await listPackageVersions(packages, npmOptions);
      expect(versions).toEqual(_.mapValues(showData, x => x.versions));
      expect(npmMock.mock).toHaveBeenCalledTimes(packages.length);
    });

    it('returns versions for multiple packages with some missing', async () => {
      npmMock.setRegistryData({ foo: { versions: ['1.0.0', '1.0.1'] } });
      const versions = await listPackageVersions(['foo', 'bar'], npmOptions);
      expect(versions).toEqual({ foo: ['1.0.0', '1.0.1'], bar: [] });
      expect(npmMock.mock).toHaveBeenCalledTimes(2);
    });

    it('respects password auth args', async () => {
      npmMock.setRegistryData({ foo: { versions: ['1.0.0', '1.0.1'] } });
      const versions = await listPackageVersions(['foo'], { ...npmOptions, authType: 'password', token: 'pass' });
      expect(versions).toEqual({ foo: ['1.0.0', '1.0.1'] });
      expect(npmMock.mock).toHaveBeenCalledWith(
        [...commonArgs, '--//fake:_password=pass', 'foo', ...npmShowProperties],
        expect.anything()
      );
    });

    it('respects token auth args', async () => {
      npmMock.setRegistryData({ foo: { versions: ['1.0.0', '1.0.1'] } });
      const versions = await listPackageVersions(['foo'], { ...npmOptions, authType: 'authtoken', token: 'pass' });
      expect(versions).toEqual({ foo: ['1.0.0', '1.0.1'] });
      expect(npmMock.mock).toHaveBeenCalledWith(
        [...commonArgs, '--//fake:_authToken=pass', 'foo', ...npmShowProperties],
        expect.anything()
      );
    });
  });

  describe('listPackageVersionsByTag', () => {
    it('succeeds with nothing to do', async () => {
      expect(await listPackageVersionsByTag([], undefined, npmOptions)).toEqual({});
      expect(await listPackageVersionsByTag([], 'beta', npmOptions)).toEqual({});
      expect(npmMock.mock).not.toHaveBeenCalled();
    });

    it('returns requested tag for one package', async () => {
      npmMock.setRegistryData({ foo: { 'dist-tags': { latest: '1.0.0', beta: '2.0.0-beta' } } });
      const packageInfos = Object.values(
        makePackageInfos({ foo: { combinedOptions: { tag: 'latest', defaultNpmTag: 'latest' } } })
      );

      const versions = await listPackageVersionsByTag(packageInfos, 'beta', npmOptions);
      expect(versions).toEqual({ foo: '2.0.0-beta' });
      expect(npmMock.mock).toHaveBeenCalledTimes(1);
      expect(npmMock.mock).toHaveBeenCalledWith([...commonArgs, 'foo', ...npmShowProperties], expect.anything());
    });

    it('returns requested tag for multiple packages', async () => {
      npmMock.setRegistryData({
        foo: { 'dist-tags': { latest: '1.0.0', beta: '2.0.0-beta' } },
        bar: { 'dist-tags': { latest: '1.0.0', beta: '3.0.0-beta' } },
      });
      const packageInfos = Object.values(
        makePackageInfos({
          foo: { combinedOptions: { tag: 'latest' } },
          bar: { combinedOptions: { tag: 'latest' } },
        })
      );

      const versions = await listPackageVersionsByTag(packageInfos, 'beta', npmOptions);
      expect(versions).toEqual({ foo: '2.0.0-beta', bar: '3.0.0-beta' });
      expect(npmMock.mock).toHaveBeenCalledTimes(2);
    });

    it('returns versions for many packages', async () => {
      const packages = 'abcdefghij'.split('');
      const showData = Object.fromEntries(packages.map((x, i) => [x, { 'dist-tags': { latest: `${i}.0.0` } }]));
      npmMock.setRegistryData(showData);
      const packageInfos = Object.values(makePackageInfos(_.mapValues(showData, () => ({}))));

      expect(await listPackageVersionsByTag(packageInfos, 'latest', npmOptions)).toEqual(
        _.mapValues(showData, x => x['dist-tags']?.latest)
      );
      expect(npmMock.mock).toHaveBeenCalledTimes(packages.length);
    });

    it('falls back to combinedOptions.tag', async () => {
      npmMock.setRegistryData({ foo: { 'dist-tags': { latest: '1.0.0', beta: '2.0.0-beta' } } });
      const packageInfos = Object.values(
        makePackageInfos({ foo: { combinedOptions: { tag: 'beta', defaultNpmTag: 'latest' } } })
      );

      const versions = await listPackageVersionsByTag(packageInfos, undefined, npmOptions);
      expect(versions).toEqual({ foo: '2.0.0-beta' });
      expect(npmMock.mock).toHaveBeenCalledTimes(1);
    });

    it('falls back to combinedOptions.defaultNpmTag if combinedOptions.tag is unset', async () => {
      npmMock.setRegistryData({ foo: { 'dist-tags': { latest: '1.0.0', beta: '2.0.0-beta' } } });
      const packageInfos = Object.values(makePackageInfos({ foo: { combinedOptions: { defaultNpmTag: 'beta' } } }));

      const versions = await listPackageVersionsByTag(packageInfos, undefined, npmOptions);
      expect(versions).toEqual({ foo: '2.0.0-beta' });
      expect(npmMock.mock).toHaveBeenCalledTimes(1);
    });

    it('returns empty if no dist-tags available', async () => {
      npmMock.setRegistryData({});
      const packageInfos = Object.values(makePackageInfos({ foo: {} }));

      const versions = await listPackageVersionsByTag(packageInfos, 'latest', npmOptions);
      expect(versions).toEqual({});
      expect(npmMock.mock).toHaveBeenCalledTimes(1);
    });

    it('returns empty if no matching dist-tags available', async () => {
      npmMock.setRegistryData({ foo: { 'dist-tags': { latest: '1.0.0', beta: '2.0.0-beta' } } });
      const packageInfos = Object.values(makePackageInfos({ foo: {} }));

      const versions = await listPackageVersionsByTag(packageInfos, 'missing', npmOptions);
      expect(versions).toEqual({});
      expect(npmMock.mock).toHaveBeenCalledTimes(1);
    });

    it('falls back to different tag option for different packages', async () => {
      npmMock.setRegistryData({
        foo: { 'dist-tags': { latest: '1.0.0', beta: '2.0.0-beta' } },
        bar: { 'dist-tags': { latest: '1.0.0', beta: '2.0.0-beta' } },
      });
      const packageInfos = Object.values(
        makePackageInfos({
          foo: { combinedOptions: { defaultNpmTag: 'latest' } },
          bar: { combinedOptions: { tag: 'beta', defaultNpmTag: 'latest' } },
        })
      );

      const versions = await listPackageVersionsByTag(packageInfos, undefined, npmOptions);
      expect(versions).toEqual({ foo: '1.0.0', bar: '2.0.0-beta' });
      expect(npmMock.mock).toHaveBeenCalledTimes(2);
    });

    it('returns versions for multiple packages with some missing', async () => {
      npmMock.setRegistryData({ foo: { 'dist-tags': { latest: '1.0.0' } } });
      const packageInfos = Object.values(makePackageInfos({ foo: {}, bar: {} }));

      const versions = await listPackageVersionsByTag(packageInfos, 'latest', npmOptions);
      expect(versions).toEqual({ foo: '1.0.0' });
      expect(npmMock.mock).toHaveBeenCalledTimes(2);
    });
  });
});
