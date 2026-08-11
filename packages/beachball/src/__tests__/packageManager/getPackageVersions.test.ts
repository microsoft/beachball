import { describe, expect, it, jest } from '@jest/globals';
import { initNpmMock, mockNpmShowError } from '../../__fixtures__/mockNpm';
import { makePackageInfos } from '../../__fixtures__/packageInfos';
import { getOptions } from '../../options/getOptions';
import { _packageContentTypeAccept } from '../../packageManager/getNpmPackageInfo';
import { getPackageTagVersions, hasPackageVersions } from '../../packageManager/getPackageVersions';
import type { NpmOptions } from '../../types/NpmOptions';

jest.mock('../../packageManager/npm');

const npmMock = initNpmMock();
const npmOptions: NpmOptions = {
  registry: 'https://fake',
  timeout: 1500,
  path: '',
  npmReadConcurrency: 2,
  defaultNpmTag: 'latest',
};

const fetchedUrls = () => npmMock.mockFetch.mock.calls.map(([url]) => (url as URL).href);

describe('hasPackageVersions', () => {
  it('succeeds with nothing to do', async () => {
    expect(await hasPackageVersions({}, npmOptions)).toEqual({});
    expect(npmMock.mockFetch).not.toHaveBeenCalled();
    expect(npmMock.mock).not.toHaveBeenCalled();
  });

  it('checks exact versions without fetching the package packument', async () => {
    npmMock.setRegistryData({
      foo: { versions: ['1.0.0', '1.0.1'] },
      bar: { versions: ['2.0.0'] },
    });

    const result = await hasPackageVersions({ foo: '1.0.1', bar: '2.0.1', baz: '1.0.0' }, npmOptions);
    expect(result).toEqual({ foo: true, bar: false, baz: false });
    expect(npmMock.mockFetch).toHaveBeenCalledTimes(3);
    expect(npmMock.mock).not.toHaveBeenCalled();
    expect(fetchedUrls()).toEqual(['https://fake/foo/1.0.1', 'https://fake/bar/2.0.1', 'https://fake/baz/1.0.0']);
  });

  it('encodes scoped package names', async () => {
    npmMock.setRegistryData({ '@scope/foo': { versions: ['1.0.0'] } });

    expect(await hasPackageVersions({ '@scope/foo': '1.0.0' }, npmOptions)).toEqual({ '@scope/foo': true });
    expect(fetchedUrls()).toEqual(['https://fake/%40scope%2Ffoo/1.0.0']);
  });

  it('passes an explicit auth token as a bearer token', async () => {
    npmMock.setRegistryData({ foo: { versions: ['1.0.0'] } });

    await hasPackageVersions({ foo: '1.0.0' }, { ...npmOptions, token: 'secret' });

    expect(npmMock.mockFetch).toHaveBeenCalledWith(
      new URL('https://fake/foo/1.0.0'),
      expect.objectContaining({ headers: { Authorization: 'Bearer secret', Accept: _packageContentTypeAccept } })
    );
  });

  it('uses npm CLI for password auth', async () => {
    npmMock.setRegistryData({ foo: { versions: ['1.0.0'] } });

    const result = await hasPackageVersions(
      { foo: '1.0.0' },
      { ...npmOptions, authType: 'password', token: 'encoded-password' }
    );
    expect(result).toEqual({ foo: true });
    expect(npmMock.mockFetch).not.toHaveBeenCalled();
    expect(npmMock.mock).toHaveBeenCalledWith(
      ['show', '--registry', 'https://fake', '--json', 'foo@1.0.0', 'name', 'version'],
      expect.objectContaining({ env: { 'npm_config_//fake/:_password': 'encoded-password' } })
    );
  });

  it('uses npm CLI when registry is not configured', async () => {
    npmMock.setRegistryData({ foo: { versions: ['1.0.0'] } });

    const result = await hasPackageVersions({ foo: '1.0.0' }, { ...npmOptions, registry: undefined });
    expect(result).toEqual({ foo: true });
    expect(npmMock.mockFetch).not.toHaveBeenCalled();
    expect(npmMock.mock).toHaveBeenCalledWith(
      ['show', '--json', 'foo@1.0.0', 'name', 'version'],
      expect.objectContaining({ cwd: '' })
    );
  });

  it('returns false when npm CLI reports E404', async () => {
    expect(await hasPackageVersions({ foo: '1.0.0' }, { ...npmOptions, registry: undefined })).toEqual({ foo: false });
  });

  it.each([401, 403])('throws when npm CLI reports E%s', async status => {
    npmMock.setCommandOverride('show', () =>
      Promise.resolve(
        // this is not a realistic message
        mockNpmShowError('foo', '1.0.0', { code: `E${status}`, summary: `Registry error`, detail: `Registry error` })
      )
    );
    await expect(hasPackageVersions({ foo: '1.0.0' }, { ...npmOptions, registry: undefined })).rejects.toThrow(
      `Getting info about "foo@1.0.0" failed: E${status} Registry error`
    );
  });
});

describe('getPackageTagVersions', () => {
  async function getOptionsAndPackages(params: {
    packageOptions?: { tag?: string; defaultNpmTag?: string };
    repoTag?: string;
    extraArgv?: string[];
  }) {
    const parsedOptions = await getOptions({
      argv: ['node', 'beachball', ...(params.extraArgv || [])],
      env: {},
      cwd: '',
      testRepoOptions: {
        registry: 'https://fake',
        npmReadConcurrency: 2,
        tag: params.repoTag,
      },
    });
    const packageInfos = makePackageInfos(
      { foo: params.packageOptions ? { beachball: params.packageOptions } : {} },
      parsedOptions.cliOptions
    );
    return { options: parsedOptions.options, packages: Object.values(packageInfos) };
  }

  it('requests the latest tag by default', async () => {
    npmMock.setRegistryData({ foo: { 'dist-tags': { latest: '1.0.0', beta: '2.0.0-beta' } } });
    const { options, packages } = await getOptionsAndPackages({});

    const versions = await getPackageTagVersions(packages, options);
    expect(versions).toEqual({ foo: '1.0.0' });
    expect((npmMock.mockFetch.mock.calls[0][0] as URL).href).toBe('https://fake/foo/latest');
  });

  it('respects package tag overrides', async () => {
    npmMock.setRegistryData({ foo: { 'dist-tags': { latest: '1.0.0', beta: '2.0.0-beta' } } });
    const { options, packages } = await getOptionsAndPackages({ packageOptions: { tag: 'beta' } });

    const versions = await getPackageTagVersions(packages, options);
    expect(versions).toEqual({ foo: '2.0.0-beta' });
    expect((npmMock.mockFetch.mock.calls[0][0] as URL).href).toBe('https://fake/foo/beta');
  });

  it('lets CLI tag override package and repo tags', async () => {
    npmMock.setRegistryData({ foo: { 'dist-tags': { alpha: '1.0.0-alpha', beta: '2.0.0-beta' } } });
    const { options, packages } = await getOptionsAndPackages({
      packageOptions: { tag: 'alpha' },
      repoTag: 'alpha',
      extraArgv: ['--tag', 'beta'],
    });

    const versions = await getPackageTagVersions(packages, options);
    expect(versions).toEqual({ foo: '2.0.0-beta' });
    expect((npmMock.mockFetch.mock.calls[0][0] as URL).href).toBe('https://fake/foo/beta');
  });

  it('omits missing packages and tags', async () => {
    npmMock.setRegistryData({ foo: { 'dist-tags': { latest: '1.0.0' } } });
    const packageInfos = makePackageInfos({ foo: {}, bar: {} });

    const versions = await getPackageTagVersions(Object.values(packageInfos), npmOptions);
    expect(versions).toEqual({ foo: '1.0.0' });
  });

  it('does not fetch packages with empty tag options', async () => {
    const { options, packages } = await getOptionsAndPackages({
      packageOptions: { tag: '', defaultNpmTag: '' },
    });

    expect(await getPackageTagVersions(packages, options)).toEqual({});
    expect(npmMock.mockFetch).not.toHaveBeenCalled();
  });
});
