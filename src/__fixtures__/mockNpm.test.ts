// The npm test fixture got complicated enough to need tests...
// But this added complexity greatly speeds up the other npm-related tests by removing the
// dependency on actual npm CLI calls and a fake registry (which are very slow).

import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import fs from 'fs-extra';
import { NpmResult, npm } from '../packageManager/npm';
import { PackageJson } from '../types/PackageInfo';
import { initNpmMock, _makeRegistryData, _mockNpmPublish, _mockNpmShow } from './mockNpm';

jest.mock('fs-extra');
jest.mock('../packageManager/npm');

describe('_makeRegistryData', () => {
  it('returns empty data', () => {
    expect(_makeRegistryData({})).toEqual({});
  });

  it('uses provided dist-tags and versions, and fills in other data', () => {
    const data = _makeRegistryData({
      foo: {
        versions: ['1.0.0', '1.0.1', '2.0.0-beta'],
        'dist-tags': { latest: '1.0.1', beta: '2.0.0-beta' },
      },
      bar: {
        versions: ['1.0.0'],
        'dist-tags': { latest: '1.0.0' },
      },
    });
    expect(data).toEqual({
      foo: {
        'dist-tags': { latest: '1.0.1', beta: '2.0.0-beta' },
        versions: ['1.0.0', '1.0.1', '2.0.0-beta'],
        versionData: {
          '1.0.0': { name: 'foo', version: '1.0.0' },
          '1.0.1': { name: 'foo', version: '1.0.1' },
          '2.0.0-beta': { name: 'foo', version: '2.0.0-beta' },
        },
      },
      bar: {
        'dist-tags': { latest: '1.0.0' },
        versions: ['1.0.0'],
        versionData: {
          '1.0.0': { name: 'bar', version: '1.0.0' },
        },
      },
    });
  });

  it('fills in missing dist-tags from versions', () => {
    const data = _makeRegistryData({
      foo: { versions: ['1.0.0', '1.0.1'] },
    });
    expect(data.foo['dist-tags']).toEqual({ latest: '1.0.1' });
  });

  it('sorts versions when determining latest dist-tag', () => {
    const data = _makeRegistryData({
      foo: { versions: ['1.0.1', '2.0.0', '0.1.0'] },
    });
    expect(data.foo['dist-tags']).toEqual({ latest: '2.0.0' });
  });

  it('fills in missing latest dist-tag from versions', () => {
    const data = _makeRegistryData({
      foo: { versions: ['1.0.0', '1.0.1', '1.0.0-beta'], 'dist-tags': { beta: '1.0.0-beta' } },
    });
    expect(data.foo['dist-tags']).toEqual({ latest: '1.0.1', beta: '1.0.0-beta' });
  });

  it('fills in missing versions from dist-tags', () => {
    const data = _makeRegistryData({
      foo: { 'dist-tags': { beta: '2.0.0-beta', latest: '1.0.1' } },
    });
    expect(data.foo.versions).toEqual(['1.0.1', '2.0.0-beta']);
  });

  it('throws if a package provides neither versions nor dist-tags', () => {
    expect(() => _makeRegistryData({ foo: {} })).toThrow(/must include either versions or dist-tags for foo/);
  });
});

describe('_mockNpmShow', () => {
  function getShowResult(
    params: { error: string } | { data: ReturnType<typeof _makeRegistryData>; name: string; version: string }
  ) {
    let output: string;
    let isError: boolean;
    if ('error' in params) {
      output = params.error;
      isError = true;
    } else {
      const { data, name, version } = params;
      output = JSON.stringify({
        // NOTE: this is sensitive to the order of keys used in _mockNpmShow
        ...data[name].versionData[version],
        'dist-tags': data[name]['dist-tags'],
        versions: data[name].versions,
      });
      isError = false;
    }

    return {
      stdout: isError ? '' : output,
      stderr: isError ? output : '',
      all: output,
      success: !isError,
      failed: isError,
    } as NpmResult;
  }

  const data = _makeRegistryData({
    foo: {
      versions: ['1.0.0-beta', '1.0.0', '1.0.1'],
      'dist-tags': { latest: '1.0.1', beta: '1.0.0-beta' },
    },
    '@foo/bar': {
      versions: ['2.0.0-beta', '2.0.0', '2.0.1'],
      'dist-tags': { latest: '2.0.1', beta: '2.0.0-beta' },
    },
  });

  it("errors if package doesn't exist", async () => {
    const emptyData = _makeRegistryData({});
    const result = await _mockNpmShow(emptyData, ['foo'], { cwd: undefined });
    expect(result).toEqual(getShowResult({ error: '[fake] code E404 - foo - not found' }));
  });

  it('returns requested version plus dist-tags and version list', async () => {
    const result = await _mockNpmShow(data, ['foo@1.0.0'], { cwd: undefined });
    expect(result).toEqual(getShowResult({ data: data, name: 'foo', version: '1.0.0' }));
  });

  it('returns requested version of scoped package', async () => {
    const result = await _mockNpmShow(data, ['@foo/bar@2.0.0'], { cwd: undefined });
    expect(result).toEqual(getShowResult({ data, name: '@foo/bar', version: '2.0.0' }));
  });

  it('returns requested tag', async () => {
    const result = await _mockNpmShow(data, ['foo@beta'], { cwd: undefined });
    expect(result).toEqual(getShowResult({ data, name: 'foo', version: '1.0.0-beta' }));
  });

  it('returns requested tag of scoped package', async () => {
    const result = await _mockNpmShow(data, ['@foo/bar@beta'], { cwd: undefined });
    expect(result).toEqual(getShowResult({ data, name: '@foo/bar', version: '2.0.0-beta' }));
  });

  it('returns latest version if no version requested', async () => {
    const result = await _mockNpmShow(data, ['foo'], { cwd: undefined });
    expect(result).toEqual(getShowResult({ data, name: 'foo', version: '1.0.1' }));
  });

  it('returns latest version of scoped package if no version requested', async () => {
    const result = await _mockNpmShow(data, ['@foo/bar'], { cwd: undefined });
    expect(result).toEqual(getShowResult({ data, name: '@foo/bar', version: '2.0.1' }));
  });

  it("errors if requested version doesn't exist", async () => {
    const result = await _mockNpmShow(data, ['foo@2.0.0'], { cwd: undefined });
    expect(result).toEqual(getShowResult({ error: '[fake] code E404 - foo@2.0.0 - not found' }));
  });

  // support for this could be added later
  it('currently throws if requested version is a range', async () => {
    await expect(() => _mockNpmShow(data, ['foo@^1.0.0'], { cwd: undefined })).rejects.toThrow(
      /not currently supported/
    );
  });
});

describe('_mockNpmPublish', () => {
  function getPublishResult(params: { error?: string; tag?: string }) {
    const { error, tag } = params;
    if (!error && !packageJson) throw new Error('packageJson not set');
    const stdout = error ? '' : `[fake] published ${packageJson?.name}@${packageJson?.version} with tag ${tag}`;
    return {
      stdout,
      stderr: error || '',
      all: stdout || error,
      success: !error,
      failed: !!error,
    } as NpmResult;
  }

  let packageJson: PackageJson | undefined;

  beforeAll(() => {
    (fs.readJsonSync as jest.MockedFunction<typeof fs.readJsonSync>).mockImplementation(() => {
      if (!packageJson) throw new Error('packageJson not set');
      return packageJson;
    });
  });

  afterEach(() => {
    packageJson = undefined;
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('throws if cwd is not specified', async () => {
    await expect(() => _mockNpmPublish({}, [], { cwd: undefined })).rejects.toThrow(
      'cwd is required for mock npm publish'
    );
  });

  it('errors if reading package.json fails', async () => {
    // this error is from the fs.readJsonSync mock, but it's the same code path as if reading the file fails
    await expect(() => _mockNpmPublish({}, [], { cwd: 'fake' })).rejects.toThrow('packageJson not set');
  });

  it('errors on re-publish', async () => {
    const data = _makeRegistryData({ foo: { versions: ['1.0.0'] } });
    packageJson = { name: 'foo', version: '1.0.0', main: 'nope.js' };
    const result = await _mockNpmPublish(data, [], { cwd: 'fake' });
    expect(result).toEqual(
      getPublishResult({
        error: '[fake] EPUBLISHCONFLICT foo@1.0.0 already exists in registry',
      })
    );
    // verify that the package didn't get updated in the fake registry
    // (the "main" field specified above won't exist on the default version)
    expect(data.foo.versionData['1.0.0'].main).toBeUndefined();
  });

  it('publishes to empty registry with default tag latest', async () => {
    const data = _makeRegistryData({});
    packageJson = { name: 'foo', version: '1.0.0', main: 'index.js' };

    const result = await _mockNpmPublish(data, [], { cwd: 'fake' });
    expect(result).toEqual(getPublishResult({ tag: 'latest' }));
    expect(data.foo).toEqual({
      versions: ['1.0.0'],
      'dist-tags': { latest: '1.0.0' },
      versionData: { '1.0.0': packageJson },
    });
  });

  it('publishes package and updates latest tag', async () => {
    const data = _makeRegistryData({
      foo: { versions: ['1.0.0'], 'dist-tags': { latest: '1.0.0' } },
    });
    packageJson = { name: 'foo', version: '2.0.0', main: 'index.js' };

    const result = await _mockNpmPublish(data, [], { cwd: 'fake' });
    expect(result).toEqual(getPublishResult({ tag: 'latest' }));
    expect(data.foo).toEqual({
      versions: ['1.0.0', '2.0.0'],
      // latest tag is updated
      'dist-tags': { latest: '2.0.0' },
      versionData: {
        '1.0.0': { name: 'foo', version: '1.0.0' },
        '2.0.0': packageJson,
      },
    });
  });

  it('publishes requested tag and does not update latest', async () => {
    const data = _makeRegistryData({
      foo: { versions: ['1.0.0'], 'dist-tags': { latest: '1.0.0', beta: '1.0.0' } },
    });
    packageJson = { name: 'foo', version: '2.0.0', main: 'index.js' };

    const result = await _mockNpmPublish(data, ['--tag', 'beta'], { cwd: 'fake' });
    expect(result).toEqual(getPublishResult({ tag: 'beta' }));
    expect(data.foo).toEqual({
      versions: ['1.0.0', '2.0.0'],
      // beta tag updated, latest not updated
      'dist-tags': { beta: '2.0.0', latest: '1.0.0' },
      versionData: {
        '1.0.0': { name: 'foo', version: '1.0.0' },
        '2.0.0': packageJson,
      },
    });
  });
});

describe('mockNpm', () => {
  const npmMock = initNpmMock();
  let packageJson: PackageJson | undefined;

  beforeAll(() => {
    (fs.readJsonSync as jest.MockedFunction<typeof fs.readJsonSync>).mockImplementation(() => {
      if (!packageJson) throw new Error('packageJson not set');
      return packageJson;
    });
  });

  afterEach(() => {
    packageJson = undefined;
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('mocks npm show', async () => {
    npmMock.setRegistryData({ foo: { versions: ['1.0.0'] } });
    const result = await npm(['show', 'foo'], { cwd: undefined });
    expect(result).toMatchObject({
      success: true,
      stdout: expect.stringContaining('"name":"foo"'),
    });
  });

  it('resets calls and registry after each test', async () => {
    expect(npmMock.mock).not.toHaveBeenCalled();
    // registry data for foo was set in the previous test but should have been cleared
    const result = await npm(['show', 'foo'], { cwd: undefined });
    expect(result).toMatchObject({
      success: false,
      stderr: expect.stringContaining('not found'),
    });
  });

  it('can "publish" a package to registry with helper', async () => {
    npmMock.publishPackage({ name: 'foo', version: '1.0.0' });
    const result = await npm(['show', 'foo'], { cwd: undefined });
    expect(result).toMatchObject({
      success: true,
      stdout: expect.stringContaining('"name":"foo"'),
    });
  });

  it('mocks npm publish', async () => {
    packageJson = { name: 'foo', version: '1.0.0' };
    const result = await npm(['publish'], { cwd: 'fake' });
    expect(result).toMatchObject({
      success: true,
      stdout: expect.stringContaining('published foo'),
    });
  });

  it('throws on unsupported command', async () => {
    await expect(() => npm(['pack'], { cwd: undefined })).rejects.toThrow('Command not supported by mock npm: pack');
  });

  it('respects mocked command', async () => {
    const mockShow = jest.fn(() => 'hi');
    npmMock.setCommandOverride('show', mockShow as any);
    const result = await npm(['show', 'foo'], { cwd: undefined });
    expect(result).toEqual('hi');
    expect(mockShow).toHaveBeenCalledWith(expect.any(Object), ['foo'], { cwd: undefined });
  });

  it("respects extra mocked command that's not normally supported", async () => {
    const mockPack = jest.fn(() => 'hi');
    npmMock.setCommandOverride('pack', mockPack as any);
    const result = await npm(['pack'], { cwd: undefined });
    expect(result).toEqual('hi');
    expect(mockPack).toHaveBeenCalledWith(expect.any(Object), [], { cwd: undefined });
  });
});
