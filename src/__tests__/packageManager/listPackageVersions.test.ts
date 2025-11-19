import { afterEach, describe, expect, it, jest } from '@jest/globals';
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
  const npmOptions: NpmOptions = { registry: 'https://fake', path: undefined, npmReadConcurrency: 2 };
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
      const expectedVerions = Object.fromEntries(Object.entries(showData).map(([k, v]) => [k, v.versions]));
      expect(versions).toEqual(expectedVerions);
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
      expect(await listPackageVersionsByTag([], npmOptions)).toEqual({});
      expect(npmMock.mock).not.toHaveBeenCalled();
    });

    it('returns requested tag for one package', async () => {
      npmMock.setRegistryData({ foo: { 'dist-tags': { latest: '1.0.0', beta: '2.0.0-beta' } } });
      const packageInfos = makePackageInfos(
        { foo: {} },
        // The merging order is actually handled by getPackageInfosWithOptions, but having a test
        // like this is good documentation.
        { tag: 'latest', defaultNpmTag: 'latest' },
        { tag: 'beta' } // CLI args should take precedence
      );

      const versions = await listPackageVersionsByTag(Object.values(packageInfos), npmOptions);
      expect(versions).toEqual({ foo: '2.0.0-beta' });
      expect(npmMock.mock).toHaveBeenCalledTimes(1);
      expect(npmMock.mock).toHaveBeenCalledWith([...commonArgs, 'foo', ...npmShowProperties], expect.anything());
    });

    it('returns requested tag for multiple packages', async () => {
      npmMock.setRegistryData({
        foo: { 'dist-tags': { latest: '1.0.0', beta: '2.0.0-beta' } },
        bar: { 'dist-tags': { latest: '1.0.0', beta: '3.0.0-beta' } },
      });
      const packageInfos = makePackageInfos(
        { foo: {}, bar: {} },
        { tag: 'latest' }, // repo
        { tag: 'beta' } // cli
      );

      const versions = await listPackageVersionsByTag(Object.values(packageInfos), npmOptions);
      expect(versions).toEqual({ foo: '2.0.0-beta', bar: '3.0.0-beta' });
      expect(npmMock.mock).toHaveBeenCalledTimes(2);
    });

    it('returns versions for many packages', async () => {
      const packages = 'abcdefghij'.split('');
      const showData = Object.fromEntries(packages.map((x, i) => [x, { 'dist-tags': { latest: `${i}.0.0` } }]));
      npmMock.setRegistryData(showData);
      const packageInfos = makePackageInfos(Object.fromEntries(packages.map(x => [x, {}])), { tag: 'latest' });

      expect(await listPackageVersionsByTag(Object.values(packageInfos), npmOptions)).toEqual(
        Object.fromEntries(Object.entries(showData).map(([k, v]) => [k, v['dist-tags'].latest]))
      );
      expect(npmMock.mock).toHaveBeenCalledTimes(packages.length);
    });

    it('falls back to beachball.tag', async () => {
      npmMock.setRegistryData({ foo: { 'dist-tags': { latest: '1.0.0', beta: '2.0.0-beta' } } });
      const packageInfos = Object.values(
        makePackageInfos({ foo: { beachball: { tag: 'beta', defaultNpmTag: 'latest' } } })
      );

      const versions = await listPackageVersionsByTag(packageInfos, npmOptions);
      expect(versions).toEqual({ foo: '2.0.0-beta' });
      expect(npmMock.mock).toHaveBeenCalledTimes(1);
    });

    it('falls back to defaultNpmTag if tag is unset', async () => {
      npmMock.setRegistryData({ foo: { 'dist-tags': { latest: '1.0.0', beta: '2.0.0-beta' } } });
      const packageInfos = Object.values(makePackageInfos({ foo: { beachball: { defaultNpmTag: 'beta' } } }));

      const versions = await listPackageVersionsByTag(packageInfos, npmOptions);
      expect(versions).toEqual({ foo: '2.0.0-beta' });
      expect(npmMock.mock).toHaveBeenCalledTimes(1);
    });

    it('returns empty if no dist-tags available', async () => {
      npmMock.setRegistryData({});
      const packageInfos = Object.values(makePackageInfos({ foo: {} }));

      const versions = await listPackageVersionsByTag(packageInfos, npmOptions);
      expect(versions).toEqual({});
      expect(npmMock.mock).toHaveBeenCalledTimes(1);
    });

    it('returns empty if no matching dist-tags available', async () => {
      npmMock.setRegistryData({ foo: { 'dist-tags': { latest: '1.0.0', beta: '2.0.0-beta' } } });
      const packageInfos = Object.values(makePackageInfos({ foo: {} }, { tag: 'missing' }));

      const versions = await listPackageVersionsByTag(packageInfos, npmOptions);
      expect(versions).toEqual({});
      expect(npmMock.mock).toHaveBeenCalledTimes(1);
    });

    it('uses per-package tag option', async () => {
      npmMock.setRegistryData({
        foo: { 'dist-tags': { latest: '1.0.0', beta: '2.0.0-beta' } },
        bar: { 'dist-tags': { latest: '1.0.0', beta: '2.0.0-beta' } },
      });
      const packageInfos = Object.values(
        makePackageInfos(
          {
            foo: {},
            bar: { beachball: { tag: 'beta' } },
          },
          { defaultNpmTag: 'latest' }
        )
      );

      const versions = await listPackageVersionsByTag(packageInfos, npmOptions);
      expect(versions).toEqual({ foo: '1.0.0', bar: '2.0.0-beta' });
      expect(npmMock.mock).toHaveBeenCalledTimes(2);
    });

    it('returns versions for multiple packages with some missing', async () => {
      npmMock.setRegistryData({ foo: { 'dist-tags': { latest: '1.0.0' } } });
      const packageInfos = Object.values(makePackageInfos({ foo: {}, bar: {} }));

      const versions = await listPackageVersionsByTag(packageInfos, npmOptions);
      expect(versions).toEqual({ foo: '1.0.0' });
      expect(npmMock.mock).toHaveBeenCalledTimes(2);
    });
  });
});
