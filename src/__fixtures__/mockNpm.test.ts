// The npm test fixture got complicated enough to need tests...
// But this added complexity greatly speeds up the other npm-related tests by removing the
// dependency on actual npm CLI calls and a fake registry (which are very slow).

import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import fs from 'fs';
import fetch from 'npm-registry-fetch';
import { type NpmResult, npm } from '../packageManager/npm';
import type { PackageJson } from '../types/PackageInfo';
import {
  initNpmMock,
  _makeRegistryData,
  _mockNpmPack,
  _mockNpmPublish,
  type MockNpmResult,
  type MockNpmCommand,
} from './mockNpm';
import * as readJsonModule from '../object/readJson';

jest.mock('fs');
jest.mock('npm-registry-fetch');
jest.mock('../object/readJson');
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
        name: 'foo',
        modified: expect.any(String),
        'dist-tags': { latest: '1.0.1', beta: '2.0.0-beta' },
        versions: {
          '1.0.0': { name: 'foo', version: '1.0.0' },
          '1.0.1': { name: 'foo', version: '1.0.1' },
          '2.0.0-beta': { name: 'foo', version: '2.0.0-beta' },
        },
      },
      bar: {
        name: 'bar',
        modified: expect.any(String),
        'dist-tags': { latest: '1.0.0' },
        versions: {
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
    expect(Object.keys(data.foo.versions)).toEqual(['1.0.1', '2.0.0-beta']);
  });

  it('throws if a package provides neither versions nor dist-tags', () => {
    expect(() => _makeRegistryData({ foo: {} })).toThrow(/must include either versions or dist-tags for foo/);
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
      output: stdout || error,
      success: !error,
    } as NpmResult;
  }

  let packageJson: PackageJson | undefined;

  beforeAll(() => {
    (readJsonModule.readJson as jest.MockedFunction<typeof readJsonModule.readJson>).mockImplementation((() => {
      if (!packageJson) throw new Error('packageJson not set');
      return packageJson;
    }) as typeof readJsonModule.readJson);
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
    expect(data.foo.versions['1.0.0'].main).toBeUndefined();
  });

  it('publishes to empty registry with default tag latest', async () => {
    const data = _makeRegistryData({});
    packageJson = { name: 'foo', version: '1.0.0', main: 'index.js' };

    const result = await _mockNpmPublish(data, [], { cwd: 'fake' });
    expect(result).toEqual(getPublishResult({ tag: 'latest' }));
    expect(data.foo).toEqual({
      name: 'foo',
      modified: expect.any(String),
      versions: { '1.0.0': packageJson },
      'dist-tags': { latest: '1.0.0' },
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
      name: 'foo',
      modified: expect.any(String),
      // latest tag is updated
      'dist-tags': { latest: '2.0.0' },
      versions: {
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
      name: 'foo',
      modified: expect.any(String),
      // beta tag updated, latest not updated
      'dist-tags': { beta: '2.0.0', latest: '1.0.0' },
      versions: {
        '1.0.0': { name: 'foo', version: '1.0.0' },
        '2.0.0': packageJson,
      },
    });
  });
});

describe('_mockNpmPack', () => {
  let packageJson: PackageJson | undefined;
  let writtenFiles: (fs.PathLike | number)[] = [];

  beforeAll(() => {
    (readJsonModule.readJson as jest.MockedFunction<typeof readJsonModule.readJson>).mockImplementation((() => {
      if (!packageJson) throw new Error('packageJson not set');
      return packageJson;
    }) as typeof readJsonModule.readJson);
    (fs.writeFileSync as jest.MockedFunction<typeof fs.writeFileSync>).mockImplementation(filePath => {
      writtenFiles.push(String(filePath).replace(/\\/g, '/'));
    });
  });

  afterEach(() => {
    packageJson = undefined;
    writtenFiles = [];
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('throws if cwd is not specified', async () => {
    await expect(() => _mockNpmPack({}, [], { cwd: undefined })).rejects.toThrow('cwd is required for mock npm pack');
  });

  it('errors if reading package.json fails', async () => {
    // this error is from the fs.readJsonSync mock, but it's the same code path as if reading the file fails
    await expect(() => _mockNpmPack({}, [], { cwd: 'fake' })).rejects.toThrow('packageJson not set');
  });

  it('packs unscoped package', async () => {
    const registryData = {};
    packageJson = { name: 'foo', version: '1.0.0' };
    const result = await _mockNpmPack(registryData, [], { cwd: 'fake' });
    expect(result).toEqual({
      success: true,
      output: 'foo-1.0.0.tgz',
      stdout: 'foo-1.0.0.tgz',
      stderr: '',
    });
    expect(writtenFiles).toEqual(['fake/foo-1.0.0.tgz']);
    expect(registryData).toEqual({});
  });

  it('packs scoped package', async () => {
    const registryData = {};
    packageJson = { name: '@foo/bar', version: '2.0.0' };
    const result = await _mockNpmPack(registryData, [], { cwd: 'fake' });
    expect(result).toEqual({
      success: true,
      output: 'foo-bar-2.0.0.tgz',
      stdout: 'foo-bar-2.0.0.tgz',
      stderr: '',
    });
    expect(writtenFiles).toEqual(['fake/foo-bar-2.0.0.tgz']);
    expect(registryData).toEqual({});
  });
});

describe('mockNpm', () => {
  const npmMock = initNpmMock();
  let packageJson: PackageJson | undefined;

  beforeAll(() => {
    (readJsonModule.readJson as jest.MockedFunction<typeof readJsonModule.readJson>).mockImplementation((() => {
      if (!packageJson) throw new Error('packageJson not set');
      return packageJson;
    }) as typeof readJsonModule.readJson);
  });

  afterEach(() => {
    packageJson = undefined;
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('mockFetchJson', () => {
    it('mocks registry fetch', async () => {
      npmMock.setRegistryData({ foo: { versions: ['1.0.0'] } });
      expect(fetch.json).toHaveProperty('mock');
      const result = await fetch.json('/foo');
      expect(result).toEqual({
        name: 'foo',
        modified: expect.any(String),
        versions: { '1.0.0': { name: 'foo', version: '1.0.0' } },
        'dist-tags': { latest: '1.0.0' },
      });
    });

    it('resets calls and registry after each test', () => {
      expect(npmMock.mockFetchJson).not.toHaveBeenCalled();
      // registry data for foo was set in the previous test but should have been cleared
      expect(() => fetch.json('/foo')).toThrow('404 Not Found');
    });
  });

  describe('getPublishedVersions', () => {
    it('gets data for a package', () => {
      npmMock.setRegistryData({ foo: { versions: ['1.0.0', '1.1.0'], 'dist-tags': { bar: '1.0.0' } } });
      expect(npmMock.getPublishedVersions('foo')).toEqual({
        versions: ['1.0.0', '1.1.0'],
        'dist-tags': { latest: '1.1.0', bar: '1.0.0' },
      });
    });

    it('returns undefined for nonexistent package', () => {
      npmMock.setRegistryData({ foo: { versions: ['1.0.0', '1.1.0'] } });
      expect(npmMock.getPublishedVersions('bar')).toBeUndefined();
    });
  });

  describe('getPublishedPackage', () => {
    function setFooData() {
      npmMock.setRegistryData({
        foo: { versions: ['1.0.0', '1.1.0'], 'dist-tags': { latest: '1.0.0', beta: '1.1.0' } },
      });
    }

    it('gets data for latest', () => {
      setFooData();
      expect(npmMock.getPublishedPackage('foo')).toEqual({ name: 'foo', version: '1.0.0' });
    });

    it('gets data for specific version', () => {
      setFooData();
      expect(npmMock.getPublishedPackage('foo', '1.1.0')).toEqual({ name: 'foo', version: '1.1.0' });
    });

    it('gets data for specific tag', () => {
      setFooData();
      expect(npmMock.getPublishedPackage('foo', 'beta')).toEqual({ name: 'foo', version: '1.1.0' });
    });

    it('returns undefined for nonexistent package', () => {
      expect(npmMock.getPublishedPackage('bar')).toBeUndefined();
      setFooData();
      expect(npmMock.getPublishedPackage('bar')).toBeUndefined();
    });
  });

  describe('publishPackage', () => {
    it('can "publish" a package to registry', async () => {
      npmMock.publishPackage({ name: 'foo', version: '1.0.0' });
      expect(npmMock.getPublishedVersions('foo')).toEqual({
        versions: ['1.0.0'],
        'dist-tags': { latest: '1.0.0' },
      });
      expect(await fetch.json('/foo')).toEqual({
        name: 'foo',
        modified: expect.any(String),
        versions: {
          '1.0.0': { name: 'foo', version: '1.0.0' },
        },
        'dist-tags': { latest: '1.0.0' },
      });
    });
  });

  describe('npm function', () => {
    it('mocks npm publish command', async () => {
      packageJson = { name: 'foo', version: '1.0.0' };
      const result = await npm(['publish'], { cwd: 'fake' });
      expect(result).toMatchObject({
        success: true,
        stdout: expect.stringContaining('published foo'),
      });
      expect(npmMock.mock).toHaveBeenCalledTimes(1);
      expect(npmMock.mock).toHaveBeenCalledWith(['publish'], expect.objectContaining({ cwd: 'fake' }));
    });

    it('mocks npm pack command', async () => {
      packageJson = { name: 'foo', version: '2.0.0' };
      const result = await npm(['pack'], { cwd: 'fake' });
      expect(result).toEqual({
        success: true,
        output: 'foo-2.0.0.tgz',
        stdout: 'foo-2.0.0.tgz',
        stderr: '',
      });
      expect(npmMock.mock).toHaveBeenCalledTimes(1);
      expect(npmMock.mock).toHaveBeenCalledWith(['pack'], expect.objectContaining({ cwd: 'fake' }));
    });

    it('throws if required cwd is missing', async () => {
      await expect(() => npm(['publish'], { cwd: undefined })).rejects.toThrow('cwd is required for mock npm publish');
      await expect(() => npm(['pack'], { cwd: undefined })).rejects.toThrow('cwd is required for mock npm pack');
    });

    it('throws on unsupported command', async () => {
      await expect(() => npm(['foo'], { cwd: undefined })).rejects.toThrow('Command not supported by mock npm: foo');
      expect(npmMock.mock).toHaveBeenCalledTimes(1);
      expect(npmMock.mock).toHaveBeenCalledWith(['foo'], expect.objectContaining({ cwd: undefined }));
    });

    it('resets calls after each test', () => {
      expect(npmMock.mock).not.toHaveBeenCalled();
    });
  });

  describe('setCommandOverride', () => {
    const fakePublishResult = 'hi';

    it('respects mocked command override', async () => {
      const mockPublish = jest.fn<MockNpmCommand>(() => Promise.resolve(fakePublishResult as unknown as MockNpmResult));
      npmMock.setCommandOverride('publish', mockPublish);
      const result = await npm(['publish', 'foo'], { cwd: undefined });
      expect(result).toEqual(fakePublishResult);
      expect(mockPublish).toHaveBeenCalledWith(expect.any(Object), ['foo'], { cwd: undefined });
    });

    it("respects extra mocked command that's not normally supported", async () => {
      const mockFoo = jest.fn<MockNpmCommand>(() => Promise.resolve('hi' as unknown as MockNpmResult));
      npmMock.setCommandOverride('foo', mockFoo);
      const result = await npm(['foo'], { cwd: undefined });
      expect(result).toEqual('hi');
      expect(mockFoo).toHaveBeenCalledWith(expect.any(Object), [], { cwd: undefined });
    });

    it('resets commands after each test', async () => {
      // extra command is gone
      await expect(() => npm(['foo'], { cwd: undefined })).rejects.toThrow('Command not supported by mock npm: foo');
      // publish mock is gone
      await expect(() => npm(['publish'], { cwd: undefined })).rejects.toThrow('cwd is required for mock npm publish');
    });
  });
});
