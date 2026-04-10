import { describe, expect, it, jest } from '@jest/globals';
import { listPackageVersions, listPackageVersionsByTag } from '../../packageManager/listPackageVersions';
import type { NpmOptions } from '../../types/NpmOptions';
import { initNpmMock } from '../../__fixtures__/mockNpm';
import { makePackageInfos, type PartialPackageInfos } from '../../__fixtures__/packageInfos';
import type { RepoOptions } from '../../types/BeachballOptions';
import { getParsedOptions } from '../../options/getOptions';
import { _npmShowProperties } from '../../packageManager/getNpmPackageInfo';

jest.mock('../../packageManager/npm');
// jest.mock('npm-registry-fetch');

//
// These tests cover aspects of listPackageVersions without a real registry.
// getNpmPackageInfo tests cover real usage of npm-registry-fetch.
//
describe('list npm versions', () => {
  /** Mock the `npm show` command for `npmAsync` calls. This also handles cleanup after each test. */
  const npmMock = initNpmMock();
  const registry = 'https://fake';
  const timeout = 1500;
  // const commonOptions = { registry, timeout };
  const commonArgs = ['show', '--registry', registry, '--json'];

  describe('listPackageVersions', () => {
    const npmOptions: NpmOptions = {
      registry,
      timeout,
      path: undefined,
      npmReadConcurrency: 2,
    };

    it('succeeds with nothing to do', async () => {
      const versions = await listPackageVersions([], npmOptions);
      expect(versions).toEqual({});
      expect(npmMock.mock).not.toHaveBeenCalled();
      // expect(npmMock.mockFetchJson).not.toHaveBeenCalled();
    });

    it('returns versions for one package', async () => {
      npmMock.setRegistryData({ foo: { versions: ['1.0.0', '1.0.1'] } });
      const versions = await listPackageVersions(['foo'], npmOptions);
      expect(versions).toEqual({ foo: ['1.0.0', '1.0.1'] });
      expect(npmMock.mock).toHaveBeenCalledTimes(1);
      expect(npmMock.mock).toHaveBeenCalledWith([...commonArgs, 'foo', ..._npmShowProperties], expect.anything());
      // expect(npmMock.mock).not.toHaveBeenCalled();
      // expect(npmMock.mockFetchJson).toHaveBeenCalledTimes(1);
      // expect(npmMock.mockFetchJson).toHaveBeenCalledWith('/foo', expect.objectContaining(commonOptions));
    });

    it('returns empty versions array for missing package', async () => {
      npmMock.setRegistryData({});
      const versions = await listPackageVersions(['foo'], npmOptions);
      expect(versions).toEqual({ foo: [] });
      expect(npmMock.mock).toHaveBeenCalledTimes(1);
      expect(npmMock.mock).toHaveBeenCalledWith([...commonArgs, 'foo', ..._npmShowProperties], expect.anything());
      // expect(npmMock.mock).not.toHaveBeenCalled();
      // expect(npmMock.mockFetchJson).toHaveBeenCalledWith('/foo', expect.objectContaining(commonOptions));
    });

    it('returns versions for multiple packages', async () => {
      const packages = 'abcdefghij'.split('');
      const showData = Object.fromEntries(packages.map((x, i) => [x, { versions: [`${i}.0.0`, `${i}.0.1`] }]));
      npmMock.setRegistryData(showData);

      const versions = await listPackageVersions(packages, npmOptions);
      const expectedVerions = Object.fromEntries(Object.entries(showData).map(([k, v]) => [k, v.versions]));
      expect(versions).toEqual(expectedVerions);
      expect(npmMock.mock).toHaveBeenCalledTimes(packages.length);
      // expect(npmMock.mock).not.toHaveBeenCalled();
      // expect(npmMock.mockFetchJson).toHaveBeenCalledTimes(packages.length);
    });

    it('returns versions for multiple packages with some missing', async () => {
      npmMock.setRegistryData({ foo: { versions: ['1.0.0', '1.0.1'] } });
      const versions = await listPackageVersions(['foo', 'bar'], npmOptions);
      expect(versions).toEqual({ foo: ['1.0.0', '1.0.1'], bar: [] });
      expect(npmMock.mock).toHaveBeenCalledTimes(2);
      // expect(npmMock.mock).not.toHaveBeenCalled();
      // expect(npmMock.mockFetchJson).toHaveBeenCalledTimes(2);
    });

    it('respects password auth args', async () => {
      npmMock.setRegistryData({ foo: { versions: ['1.0.0', '1.0.1'] } });
      const versions = await listPackageVersions(['foo'], { ...npmOptions, authType: 'password', token: 'pass' });
      expect(versions).toEqual({ foo: ['1.0.0', '1.0.1'] });
      expect(npmMock.mock).toHaveBeenCalledWith(
        [...commonArgs, '--//fake:_password=pass', 'foo', ..._npmShowProperties],
        expect.anything()
      );
      // expect(npmMock.mockFetchJson).toHaveBeenCalledWith(
      //   '/foo',
      //   expect.objectContaining({ ...commonOptions, '//fake:_password': 'pass' })
      // );
    });

    it('respects token auth args', async () => {
      npmMock.setRegistryData({ foo: { versions: ['1.0.0', '1.0.1'] } });
      const versions = await listPackageVersions(['foo'], { ...npmOptions, authType: 'authtoken', token: 'pass' });
      expect(versions).toEqual({ foo: ['1.0.0', '1.0.1'] });
      expect(npmMock.mock).toHaveBeenCalledWith(
        [...commonArgs, '--//fake:_authToken=pass', 'foo', ..._npmShowProperties],
        expect.anything()
      );
      // expect(npmMock.mockFetchJson).toHaveBeenCalledWith(
      //   '/foo',
      //   expect.objectContaining({ ...commonOptions, '//fake:_authToken': 'pass' })
      // );
    });
  });

  describe('listPackageVersionsByTag', () => {
    function getOptionsAndPackages(params: {
      packages: PartialPackageInfos;
      /** CLI options which override any package-specific options */
      extraArgv?: string[];
      /** Options to override the defaults */
      repoOptions?: Partial<RepoOptions>;
    }) {
      const parsedOptions = getParsedOptions({
        argv: ['node', 'beachball', ...(params.extraArgv || [])],
        cwd: '',
        testRepoOptions: {
          registry,
          timeout,
          npmReadConcurrency: 2,
          ...params.repoOptions,
        },
      });
      const packageInfos = makePackageInfos(params.packages, parsedOptions.cliOptions);

      return { options: parsedOptions.options, packages: Object.values(packageInfos) };
    }

    describe('defaults and repo options', () => {
      it('succeeds with no packages', async () => {
        const { packages, options } = getOptionsAndPackages({ packages: {} });
        expect(await listPackageVersionsByTag(packages, options)).toEqual({});
        expect(npmMock.mock).not.toHaveBeenCalled();
        // expect(npmMock.mockFetchJson).not.toHaveBeenCalled();
      });

      it('returns latest tag by default', async () => {
        npmMock.setRegistryData({ foo: { 'dist-tags': { latest: '1.0.0', beta: '2.0.0-beta' } } });
        const { packages, options } = getOptionsAndPackages({
          packages: { foo: {} },
        });
        // currently this is how the default to "latest" works in realistic scenarios
        expect(options).toMatchObject({ tag: '', defaultNpmTag: 'latest' });

        const versions = await listPackageVersionsByTag(packages, options);
        expect(versions).toEqual({ foo: '1.0.0' });
        expect(npmMock.mock).toHaveBeenCalledTimes(1);
        expect(npmMock.mock).toHaveBeenCalledWith([...commonArgs, 'foo', ..._npmShowProperties], expect.anything());
        // expect(npmMock.mockFetchJson).toHaveBeenCalledTimes(1);
        // expect(npmMock.mockFetchJson).toHaveBeenCalledWith('/foo', expect.objectContaining(commonOptions));
        // should not use npm CLI wrapper
        // expect(npmMock.mock).not.toHaveBeenCalled();
      });

      it('returns requested tag from repo options', async () => {
        npmMock.setRegistryData({
          foo: { 'dist-tags': { latest: '1.0.0', beta: '2.0.0-beta' } },
          bar: { 'dist-tags': { latest: '1.0.0', beta: '3.0.0-beta' } },
        });
        const { packages, options } = getOptionsAndPackages({
          packages: { foo: {}, bar: {} },
          repoOptions: { tag: 'beta' },
        });

        const versions = await listPackageVersionsByTag(packages, options);
        expect(versions).toEqual({ foo: '2.0.0-beta', bar: '3.0.0-beta' });
        expect(npmMock.mock).toHaveBeenCalledTimes(2);
        expect(npmMock.mock).toHaveBeenCalledWith([...commonArgs, 'foo', ..._npmShowProperties], expect.anything());
        expect(npmMock.mock).toHaveBeenCalledWith([...commonArgs, 'bar', ..._npmShowProperties], expect.anything());
        // expect(npmMock.mockFetchJson).toHaveBeenCalledTimes(2);
        // expect(npmMock.mockFetchJson).toHaveBeenCalledWith('/foo', expect.objectContaining(commonOptions));
        // expect(npmMock.mockFetchJson).toHaveBeenCalledWith('/bar', expect.objectContaining(commonOptions));
      });

      it('returns versions for many packages', async () => {
        const packages = 'abcdefghij'.split('');
        const showData = Object.fromEntries(packages.map((x, i) => [x, { 'dist-tags': { latest: `${i}.0.0` } }]));
        npmMock.setRegistryData(showData);
        const { packages: packageInfos, options } = getOptionsAndPackages({
          packages: Object.fromEntries(packages.map(x => [x, {}])),
          repoOptions: { tag: 'latest' },
        });

        expect(await listPackageVersionsByTag(packageInfos, options)).toEqual(
          Object.fromEntries(Object.entries(showData).map(([k, v]) => [k, v['dist-tags'].latest]))
        );
        expect(npmMock.mock).toHaveBeenCalledTimes(packages.length);
        // expect(npmMock.mockFetchJson).toHaveBeenCalledTimes(packages.length);
      });

      it('returns empty if no dist-tags available', async () => {
        npmMock.setRegistryData({});
        const { packages, options } = getOptionsAndPackages({
          packages: { foo: {} },
        });

        const versions = await listPackageVersionsByTag(packages, options);
        expect(versions).toEqual({});
        expect(npmMock.mock).toHaveBeenCalledTimes(1);
        // expect(npmMock.mockFetchJson).toHaveBeenCalledTimes(1);
      });

      it('returns empty if no matching dist-tags available', async () => {
        npmMock.setRegistryData({ foo: { 'dist-tags': { latest: '1.0.0', beta: '2.0.0-beta' } } });
        const { packages, options } = getOptionsAndPackages({
          packages: { foo: {} },
          repoOptions: { tag: 'missing' },
        });

        const versions = await listPackageVersionsByTag(packages, options);
        expect(versions).toEqual({});
        expect(npmMock.mock).toHaveBeenCalledTimes(1);
        // expect(npmMock.mockFetchJson).toHaveBeenCalledTimes(1);
      });

      it("omits packages that don't exist in registry", async () => {
        npmMock.setRegistryData({ foo: { 'dist-tags': { latest: '1.0.0' } } });
        const { packages, options } = getOptionsAndPackages({
          packages: { foo: {}, bar: {} },
        });

        const versions = await listPackageVersionsByTag(packages, options);
        expect(versions).toEqual({ foo: '1.0.0' });
        expect(npmMock.mock).toHaveBeenCalledTimes(2);
        // expect(npmMock.mockFetchJson).toHaveBeenCalledTimes(2);
      });

      it('does nothing if both tag and defaultNpmTag are empty', async () => {
        const { packages, options } = getOptionsAndPackages({
          packages: { foo: {} },
          repoOptions: { tag: '', defaultNpmTag: '' },
        });

        const versions = await listPackageVersionsByTag(packages, options);
        expect(versions).toEqual({});
        expect(npmMock.mock).not.toHaveBeenCalled();
        // expect(npmMock.mockFetchJson).not.toHaveBeenCalled();
      });
    });

    describe('package options', () => {
      it('uses per-package tag option', async () => {
        npmMock.setRegistryData({
          foo: { 'dist-tags': { latest: '1.0.0', beta: '2.0.0-beta' } },
          bar: { 'dist-tags': { latest: '1.0.0', beta: '3.0.0-beta' } },
        });
        const { packages, options } = getOptionsAndPackages({
          packages: {
            foo: { beachball: { tag: 'beta', defaultNpmTag: 'nope' } },
            bar: {},
          },
        });

        const versions = await listPackageVersionsByTag(packages, options);
        expect(versions).toEqual({ foo: '2.0.0-beta', bar: '1.0.0' });
        expect(npmMock.mock).toHaveBeenCalledTimes(2);
        // expect(npmMock.mockFetchJson).toHaveBeenCalledTimes(2);
      });

      it('falls back to package defaultNpmTag if tag is unset', async () => {
        npmMock.setRegistryData({
          foo: { 'dist-tags': { latest: '1.0.0', beta: '2.0.0-beta' } },
          bar: { 'dist-tags': { latest: '1.0.0', beta: '3.0.0-beta' } },
        });
        const { packages, options } = getOptionsAndPackages({
          packages: { foo: { beachball: { defaultNpmTag: 'beta' } }, bar: {} },
        });

        const versions = await listPackageVersionsByTag(packages, options);
        expect(versions).toEqual({ foo: '2.0.0-beta', bar: '1.0.0' });
        expect(npmMock.mock).toHaveBeenCalledTimes(2);
        // expect(npmMock.mockFetchJson).toHaveBeenCalledTimes(2);
      });

      it('does nothing if package override tag and defaultNpmTag are empty', async () => {
        const { packages, options } = getOptionsAndPackages({
          packages: { foo: { beachball: { tag: '', defaultNpmTag: '' } } },
          repoOptions: { tag: 'latest', defaultNpmTag: 'latest' },
        });

        const versions = await listPackageVersionsByTag(packages, options);
        expect(versions).toEqual({});
        expect(npmMock.mock).not.toHaveBeenCalled();
        // expect(npmMock.mockFetchJson).not.toHaveBeenCalled();
      });
    });

    describe('CLI options override', () => {
      // it's expected that token is only specified as a CLI arg
      it('respects token auth args', async () => {
        npmMock.setRegistryData({ foo: { 'dist-tags': { latest: '1.0.0', beta: '2.0.0-beta' } } });
        const { packages, options } = getOptionsAndPackages({
          packages: { foo: {} },
          extraArgv: ['--token', 'pass'],
        });
        // authtoken is the default auth type
        expect(options).toMatchObject({ authType: 'authtoken', token: 'pass' });

        const versions = await listPackageVersionsByTag(packages, options);
        expect(versions).toEqual({ foo: '1.0.0' });
        expect(npmMock.mock).toHaveBeenCalledWith(
          [...commonArgs, '--//fake:_authToken=pass', 'foo', ..._npmShowProperties],
          expect.anything()
        );
        // expect(npmMock.mockFetchJson).toHaveBeenCalledWith(
        //   '/foo',
        //   expect.objectContaining({ ...commonOptions, '//fake:_authToken': 'pass' })
        // );
      });

      it('respects password auth args', async () => {
        npmMock.setRegistryData({ foo: { 'dist-tags': { latest: '1.0.0', beta: '2.0.0-beta' } } });
        const { packages, options } = getOptionsAndPackages({
          packages: { foo: {} },
          extraArgv: ['--authType', 'password', '--token', 'pass'],
        });
        expect(options).toMatchObject({ authType: 'password', token: 'pass' });

        const versions = await listPackageVersionsByTag(packages, options);
        expect(versions).toEqual({ foo: '1.0.0' });
        expect(npmMock.mock).toHaveBeenCalledWith(
          [...commonArgs, '--//fake:_password=pass', 'foo', ..._npmShowProperties],
          expect.anything()
        );
        // expect(npmMock.mockFetchJson).toHaveBeenCalledWith(
        //   '/foo',
        //   expect.objectContaining({ ...commonOptions, '//fake:_password': 'pass' })
        // );
      });

      // This full scenario uses code outside listPackageVersionsByTag, but it's good to cover realistically
      it('overrides repo tag with CLI tag', async () => {
        npmMock.setRegistryData({
          foo: { 'dist-tags': { latest: '1.0.0', alpha: '1.5.0-alpha', beta: '2.0.0-beta' } },
        });
        const { packages, options } = getOptionsAndPackages({
          packages: { foo: {} },
          repoOptions: { tag: 'alpha' },
          extraArgv: ['--tag', 'beta'],
        });

        const versions = await listPackageVersionsByTag(packages, options);
        expect(versions).toEqual({ foo: '2.0.0-beta' });
        expect(npmMock.mock).toHaveBeenCalledTimes(1);
        // expect(npmMock.mockFetchJson).toHaveBeenCalledTimes(1);
      });

      it('overrides package tag with CLI tag', async () => {
        npmMock.setRegistryData({
          foo: { 'dist-tags': { latest: '1.0.0', alpha: '1.5.0-alpha', beta: '2.0.0-beta' } },
        });
        const { packages, options } = getOptionsAndPackages({
          packages: { foo: { beachball: { tag: 'alpha' } } },
          extraArgv: ['--tag', 'beta'], // CLI args should take precedence
        });

        const versions = await listPackageVersionsByTag(packages, options);
        expect(versions).toEqual({ foo: '2.0.0-beta' });
        expect(npmMock.mock).toHaveBeenCalledTimes(1);
        // expect(npmMock.mockFetchJson).toHaveBeenCalledTimes(1);
      });

      it('overrides package tag with CLI tag', async () => {
        npmMock.setRegistryData({
          foo: { 'dist-tags': { latest: '1.0.0', alpha: '1.5.0-alpha', beta: '2.0.0-beta' } },
          bar: { 'dist-tags': { latest: '1.0.0', beta: '3.0.0-beta' } },
        });
        const { packages, options } = getOptionsAndPackages({
          packages: { foo: { beachball: { tag: 'alpha' } }, bar: {} },
          extraArgv: ['--tag', 'beta'], // CLI args should take precedence
        });

        const versions = await listPackageVersionsByTag(packages, options);
        expect(versions).toEqual({ foo: '2.0.0-beta', bar: '3.0.0-beta' });
        expect(npmMock.mock).toHaveBeenCalledTimes(2);
        // expect(npmMock.mock).not.toHaveBeenCalled();
        // expect(npmMock.mockFetchJson).toHaveBeenCalledTimes(2);
      });

      it('overrides empty package tag and defaultNpmTag with CLI tag', async () => {
        npmMock.setRegistryData({
          foo: { 'dist-tags': { latest: '1.0.0', beta: '2.0.0-beta' } },
        });
        const { packages, options } = getOptionsAndPackages({
          packages: { foo: { beachball: { tag: '', defaultNpmTag: '' } } },
          extraArgv: ['--tag', 'beta'],
        });

        const versions = await listPackageVersionsByTag(packages, options);
        expect(versions).toEqual({ foo: '2.0.0-beta' });
        expect(npmMock.mock).toHaveBeenCalledTimes(1);
        // expect(npmMock.mockFetchJson).toHaveBeenCalledTimes(1);
      });
    });
  });
});
