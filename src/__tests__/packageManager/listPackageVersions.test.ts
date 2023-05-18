import { afterEach, describe, expect, it, jest } from '@jest/globals';
import _ from 'lodash';
import {
  listPackageVersions,
  listPackageVersionsByTag,
  _clearPackageVersionsCache,
} from '../../packageManager/listPackageVersions';
import { NpmOptions } from '../../types/NpmOptions';
import { initNpmAsyncMock } from '../../__fixtures__/mockNpm';
import { makePackageInfos } from '../../__fixtures__/packageInfos';

jest.mock('../../packageManager/npm');

describe('list npm versions', () => {
  /** Mock the `npm show` command for `npmAsync` calls. This also handles cleanup after each test. */
  const npmMock = initNpmAsyncMock();
  const npmOptions: NpmOptions = { registry: 'https://fake' };

  afterEach(() => {
    _clearPackageVersionsCache();
  });

  describe('listPackageVersions', () => {
    it('succeeds with nothing to do', async () => {
      expect(await listPackageVersions([], npmOptions)).toEqual({});
      expect(npmMock.spy).not.toHaveBeenCalled();
    });

    it('returns versions for one package', async () => {
      npmMock.setShowData({ foo: { versions: ['1.0.0', '1.0.1'] } });
      expect(await listPackageVersions(['foo'], npmOptions)).toEqual({ foo: ['1.0.0', '1.0.1'] });
      expect(npmMock.spy).toHaveBeenCalledTimes(1);
      expect(npmMock.spy).toHaveBeenCalledWith(
        ['show', '--registry', 'https://fake', '--json', 'foo'],
        expect.anything()
      );
    });

    it('returns empty versions array for missing package', async () => {
      npmMock.setShowData({});
      expect(await listPackageVersions(['foo'], npmOptions)).toEqual({ foo: [] });
      expect(npmMock.spy).toHaveBeenCalledTimes(1);
      expect(npmMock.spy).toHaveBeenCalledWith(
        ['show', '--registry', 'https://fake', '--json', 'foo'],
        expect.anything()
      );
    });

    it('returns versions for multiple packages', async () => {
      const packages = 'abcdefghij'.split('');
      const showData = Object.fromEntries(packages.map((x, i) => [x, { versions: [`${i}.0.0`, `${i}.0.1`] }]));
      npmMock.setShowData(showData);

      expect(await listPackageVersions(packages, npmOptions)).toEqual(_.mapValues(showData, x => x.versions));
      expect(npmMock.spy).toHaveBeenCalledTimes(packages.length);
    });

    it('returns versions for multiple packages with some missing', async () => {
      npmMock.setShowData({ foo: { versions: ['1.0.0', '1.0.1'] } });
      expect(await listPackageVersions(['foo', 'bar'], npmOptions)).toEqual({ foo: ['1.0.0', '1.0.1'], bar: [] });
      expect(npmMock.spy).toHaveBeenCalledTimes(2);
    });

    it('respects password auth args', async () => {
      npmMock.setShowData({});
      await listPackageVersions(['foo'], { ...npmOptions, authType: 'password', token: 'pass' });
      expect(npmMock.spy).toHaveBeenCalledWith(
        ['show', '--registry', 'https://fake', '--json', 'foo', '--//fake:_password=pass'],
        expect.anything()
      );
    });

    it('respects token auth args', async () => {
      npmMock.setShowData({});
      await listPackageVersions(['foo'], { ...npmOptions, authType: 'authtoken', token: 'pass' });
      expect(npmMock.spy).toHaveBeenCalledWith(
        ['show', '--registry', 'https://fake', '--json', 'foo', '--//fake:_authToken=pass'],
        expect.anything()
      );
    });
  });

  describe('listPackageVersionsByTag', () => {
    it('succeeds with nothing to do', async () => {
      expect(await listPackageVersionsByTag([], undefined, npmOptions)).toEqual({});
      expect(await listPackageVersionsByTag([], 'beta', npmOptions)).toEqual({});
      expect(npmMock.spy).not.toHaveBeenCalled();
    });

    it('returns requested tag for one package', async () => {
      npmMock.setShowData({ foo: { 'dist-tags': { latest: '1.0.0', beta: '2.0.0-beta' } } });
      const packageInfos = Object.values(
        makePackageInfos({ foo: { combinedOptions: { tag: 'latest', defaultNpmTag: 'latest' } } })
      );

      const versions = await listPackageVersionsByTag(packageInfos, 'beta', npmOptions);
      expect(versions).toEqual({ foo: '2.0.0-beta' });
      expect(npmMock.spy).toHaveBeenCalledTimes(1);
      expect(npmMock.spy).toHaveBeenCalledWith(
        ['show', '--registry', 'https://fake', '--json', 'foo'],
        expect.anything()
      );
    });

    it('returns requested tag for multiple packages', async () => {
      npmMock.setShowData({
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
      expect(npmMock.spy).toHaveBeenCalledTimes(2);
    });

    it('returns versions for many packages', async () => {
      const packages = 'abcdefghij'.split('');
      const showData = Object.fromEntries(packages.map((x, i) => [x, { 'dist-tags': { latest: `${i}.0.0` } }]));
      npmMock.setShowData(showData);
      const packageInfos = Object.values(makePackageInfos(_.mapValues(showData, () => ({}))));

      expect(await listPackageVersionsByTag(packageInfos, 'latest', npmOptions)).toEqual(
        _.mapValues(showData, x => x['dist-tags']?.latest)
      );
      expect(npmMock.spy).toHaveBeenCalledTimes(packages.length);
    });

    it('falls back to combinedOptions.tag', async () => {
      npmMock.setShowData({ foo: { 'dist-tags': { latest: '1.0.0', beta: '2.0.0-beta' } } });
      const packageInfos = Object.values(
        makePackageInfos({ foo: { combinedOptions: { tag: 'beta', defaultNpmTag: 'latest' } } })
      );

      const versions = await listPackageVersionsByTag(packageInfos, undefined, npmOptions);
      expect(versions).toEqual({ foo: '2.0.0-beta' });
      expect(npmMock.spy).toHaveBeenCalledTimes(1);
    });

    it('falls back to combinedOptions.defaultNpmTag if combinedOptions.tag is unset', async () => {
      npmMock.setShowData({ foo: { 'dist-tags': { latest: '1.0.0', beta: '2.0.0-beta' } } });
      const packageInfos = Object.values(makePackageInfos({ foo: { combinedOptions: { defaultNpmTag: 'beta' } } }));

      const versions = await listPackageVersionsByTag(packageInfos, undefined, npmOptions);
      expect(versions).toEqual({ foo: '2.0.0-beta' });
      expect(npmMock.spy).toHaveBeenCalledTimes(1);
    });

    it('returns empty if no dist-tags available', async () => {
      npmMock.setShowData({});
      const packageInfos = Object.values(makePackageInfos({ foo: {} }));

      const versions = await listPackageVersionsByTag(packageInfos, 'latest', npmOptions);
      expect(versions).toEqual({});
      expect(npmMock.spy).toHaveBeenCalledTimes(1);
    });

    it('returns empty if no matching dist-tags available', async () => {
      npmMock.setShowData({ foo: { 'dist-tags': { latest: '1.0.0', beta: '2.0.0-beta' } } });
      const packageInfos = Object.values(makePackageInfos({ foo: {} }));

      const versions = await listPackageVersionsByTag(packageInfos, 'missing', npmOptions);
      expect(versions).toEqual({});
      expect(npmMock.spy).toHaveBeenCalledTimes(1);
    });

    it('falls back to different tag option for different packages', async () => {
      npmMock.setShowData({
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
      expect(npmMock.spy).toHaveBeenCalledTimes(2);
    });

    it('returns versions for multiple packages with some missing', async () => {
      npmMock.setShowData({ foo: { 'dist-tags': { latest: '1.0.0' } } });
      const packageInfos = Object.values(makePackageInfos({ foo: {}, bar: {} }));

      const versions = await listPackageVersionsByTag(packageInfos, 'latest', npmOptions);
      expect(versions).toEqual({ foo: '1.0.0' });
      expect(npmMock.spy).toHaveBeenCalledTimes(2);
    });
  });
});
