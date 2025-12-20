import { describe, expect, it, afterEach, jest } from '@jest/globals';
import type { PackageInfos, PackageJson, PublishConfig } from '../../types/PackageInfo';
import { makePackageInfos, type PartialPackageInfos } from '../../__fixtures__/packageInfos';
import { readJson as _readJson } from '../../object/readJson';
import { writeJson as _writeJson } from '../../object/writeJson';
import {
  _performPublishConfigOverrides,
  _performVersionOverrides,
  performPublishOverrides,
} from '../../publish/performPublishOverrides';
import { cloneObject } from '../../object/cloneObject';
import type { Catalogs } from 'workspace-tools';

jest.mock('../../object/readJson');
jest.mock('../../object/writeJson');

function createPackageJson(json: { name: string } & Partial<PackageJson>): PackageJson {
  return {
    version: '1.0.0',
    // these values can potentially be overridden by publishConfig
    main: 'src/index.ts',
    bin: 'src/foo-bin.ts',
    ...json,
  };
}

function createFixture(partialPackageJsons: Record<string, Partial<PackageJson>>): {
  packageInfos: PackageInfos;
  packageJsons: Record<string, PackageJson>;
} {
  const packageJsons: Record<string, PackageJson> = {};
  for (const [name, json] of Object.entries(partialPackageJsons)) {
    packageJsons[name] = createPackageJson({ name, version: '1.0.0', ...json });
  }

  const partialInfos: PartialPackageInfos = {};
  for (const [name, json] of Object.entries(packageJsons)) {
    // As of writing, only the path and version are needed
    // (dependencies etc are read from original package.json)
    partialInfos[name] = {
      packageJsonPath: `packages/${name}/package.json`,
      version: json.version,
    };
  }
  const packageInfos = makePackageInfos(partialInfos);

  return { packageInfos, packageJsons };
}

describe('_performPublishConfigOverrides', () => {
  it('returns false if no publishConfig', () => {
    const packageJson = createPackageJson({ name: 'foo' });
    const updated = cloneObject(packageJson);

    const hasOverrides = _performPublishConfigOverrides(updated);
    expect(hasOverrides).toBe(false);
    expect(updated).toEqual(packageJson);
  });

  it('overrides accepted publishConfig keys and preserves values not specified', () => {
    const publishConfig: PublishConfig = {
      main: 'lib/index.js',
      types: 'lib/index.d.ts',
    };
    const original = createPackageJson({ name: 'foo', publishConfig });
    const updated = cloneObject(original);

    const hasOverrides = _performPublishConfigOverrides(updated);
    expect(hasOverrides).toBe(true);
    // package.json data with publishConfig values promoted to root,
    // and any original values not specified in publishConfig preserved
    expect(updated).toEqual({
      ...original,
      ...publishConfig,
      publishConfig: {},
    });
  });

  it('does not override non-accepted publishConfig keys', () => {
    const publishConfig = { version: '1.2.3', bin: 'foo', extra: 'nope' } as unknown as PublishConfig;
    const original = createPackageJson({ name: 'foo', publishConfig });
    const updated = cloneObject(original);

    const hasOverrides = _performPublishConfigOverrides(updated);
    expect(hasOverrides).toBe(true);
    const { bin, ...rest } = publishConfig;
    expect(updated).toEqual({ ...original, bin, publishConfig: rest });
  });

  it('returns false if no valid publishConfig keys', () => {
    const publishConfig = { version: '1.2.3', extra: 'nope' } as unknown as PublishConfig;
    const original = createPackageJson({ name: 'foo', publishConfig });
    const updated = cloneObject(original);

    const hasOverrides = _performPublishConfigOverrides(updated);
    expect(hasOverrides).toBe(false);
    expect(updated).toEqual(original);
  });
});

describe('_performVersionOverrides', () => {
  it('returns false if nothing to do', () => {
    const { packageInfos, packageJsons } = createFixture({
      foo: { version: '1.0.0' },
      bar: { version: '2.0.0', dependencies: { foo: '^1.0.0' } },
    });
    const original = packageJsons.bar;
    const updated = cloneObject(original);

    const hasOverrides = _performVersionOverrides(updated, packageInfos, undefined);
    expect(hasOverrides).toBe(false);
    expect(updated).toEqual(original);
  });

  it.each([
    ['workspace:*', '1.0.1'],
    ['workspace:~', '~1.0.1'],
    ['workspace:^', '^1.0.1'],
    ['workspace:~1.0.0', '~1.0.0'],
    ['workspace:^1.0.0', '^1.0.0'],
  ])('overrides %s dependency versions', (dependencyVersion, expectedPublishVersion) => {
    const { packageInfos, packageJsons } = createFixture({
      foo: { version: '1.0.1' },
      bar: { version: '2.0.0', dependencies: { foo: dependencyVersion } },
    });
    expect(packageJsons.bar.dependencies!.foo).toBe(dependencyVersion);

    const original = packageJsons.bar;
    const updated = cloneObject(original);
    const hasOverrides = _performVersionOverrides(updated, packageInfos, undefined);

    expect(hasOverrides).toBe(true);
    expect(updated).toEqual({
      ...original,
      dependencies: { foo: expectedPublishVersion },
    });
  });

  it('overrides version from default catalog', () => {
    const { packageInfos, packageJsons } = createFixture({
      foo: { version: '1.0.0' },
      bar: { version: '2.0.0', dependencies: { react: 'catalog:' } },
    });
    expect(packageJsons.bar.dependencies!.react).toBe('catalog:');
    const catalogs: Catalogs = {
      default: { react: '^18.0.0' },
    };

    const original = packageJsons.bar;
    const updated = cloneObject(original);
    const hasOverrides = _performVersionOverrides(updated, packageInfos, catalogs);

    expect(hasOverrides).toBe(true);
    expect(updated).toEqual({
      ...original,
      dependencies: { react: '^18.0.0' },
    });
  });

  it('overrides version from named catalog', () => {
    const { packageInfos, packageJsons } = createFixture({
      foo: { version: '1.0.0' },
      bar: { version: '2.0.0', dependencies: { react: 'catalog:react18' } },
    });
    expect(packageJsons.bar.dependencies!.react).toBe('catalog:react18');
    const catalogs: Catalogs = {
      named: {
        react18: { react: '^18.0.0' },
      },
    };

    const original = packageJsons.bar;
    const updated = cloneObject(original);
    const hasOverrides = _performVersionOverrides(updated, packageInfos, catalogs);

    expect(hasOverrides).toBe(true);
    expect(updated).toEqual({
      ...original,
      dependencies: { react: '^18.0.0' },
    });
  });

  it('overrides workspace version from catalog', () => {
    const { packageInfos, packageJsons } = createFixture({
      foo: { version: '1.0.0' },
      bar: { version: '2.0.0', dependencies: { foo: 'catalog:hmm' } },
    });
    expect(packageJsons.bar.dependencies!.foo).toBe('catalog:hmm');
    const catalogs: Catalogs = {
      named: {
        hmm: { foo: 'workspace:^' },
      },
    };

    const original = packageJsons.bar;
    const updated = cloneObject(original);
    const hasOverrides = _performVersionOverrides(updated, packageInfos, catalogs);

    expect(hasOverrides).toBe(true);
    expect(updated).toEqual({
      ...original,
      dependencies: { foo: '^1.0.0' },
    });
  });
});

describe('performPublishOverrides', () => {
  const mockReadJson = _readJson as jest.MockedFunction<typeof _readJson>;
  const mockWriteJson = _writeJson as jest.MockedFunction<typeof _writeJson>;

  afterEach(() => {
    // clear the implementations and calls for read/writeJson
    jest.resetAllMocks();
  });

  function createFullFixture(partialPackageJsons: Record<string, Partial<PackageJson>>): {
    packageInfos: PackageInfos;
    packageJsons: Record<string, PackageJson>;
  } {
    const { packageInfos, packageJsons } = createFixture(partialPackageJsons);

    mockReadJson.mockImplementation((path => {
      for (const pkg of Object.values(packageInfos)) {
        if (path === pkg.packageJsonPath) {
          // performPublishConfigOverrides mutates the packageJson, so we need to clone it to
          // simulate reading the file from the disk and avoid mutating original fixtures.
          // This is also just safer in general for tests that use this method for before/after comparisons.
          return cloneObject(packageJsons[pkg.name]);
        }
      }
      throw new Error(`not found: ${path}`);
    }) as typeof _readJson);

    return { packageInfos, packageJsons };
  }

  it('overrides accepted publishConfig keys and preserves values not specified', () => {
    const publishConfig: PublishConfig = {
      main: 'lib/index.js',
      types: 'lib/index.d.ts',
    };
    const { packageInfos, packageJsons } = createFullFixture({ foo: { publishConfig } });
    expect(packageJsons.foo).not.toMatchObject(publishConfig);

    performPublishOverrides(['foo'], packageInfos, undefined);

    expect(mockWriteJson).toHaveBeenCalledTimes(1);
    expect(publishConfig).toEqual({
      main: 'lib/index.js',
      types: 'lib/index.d.ts',
    });
    expect(mockWriteJson).toHaveBeenCalledWith(
      packageInfos.foo.packageJsonPath,
      // package.json data with publishConfig values promoted to root,
      // and any original values not specified in publishConfig preserved
      {
        ...packageJsons.foo,
        ...publishConfig,
        publishConfig: {},
      }
    );
  });

  it('does not override non-accepted publishConfig keys', () => {
    const publishConfig = { version: '1.2.3', extra: 'nope' } as unknown as PublishConfig;
    const { packageInfos, packageJsons } = createFullFixture({ foo: { publishConfig } });
    expect(packageJsons.foo).not.toMatchObject(publishConfig);

    performPublishOverrides(['foo'], packageInfos, undefined);

    expect(mockWriteJson).not.toHaveBeenCalled();
  });

  it('performs overrides for multiple packages', () => {
    const { packageInfos, packageJsons } = createFullFixture({
      foo: { publishConfig: { main: 'lib/index.js' } },
      bar: { publishConfig: { types: 'lib/index.d.ts' } },
    });
    const originalFoo = packageJsons.foo;
    const originalBar = packageJsons.bar;
    expect(originalFoo).not.toMatchObject(originalFoo.publishConfig!);
    expect(originalBar).not.toMatchObject(originalBar.publishConfig!);

    performPublishOverrides(['foo', 'bar'], packageInfos, undefined);

    expect(mockWriteJson).toHaveBeenCalledTimes(2);
    expect(mockWriteJson).toHaveBeenCalledWith(packageInfos.foo.packageJsonPath, {
      ...originalFoo,
      ...originalFoo.publishConfig,
      publishConfig: {},
    });
    expect(mockWriteJson).toHaveBeenCalledWith(packageInfos.bar.packageJsonPath, {
      ...originalBar,
      ...originalBar.publishConfig,
      publishConfig: {},
    });
  });

  it.each([
    ['workspace:*', '1.0.0'],
    ['workspace:~', '~1.0.0'],
    ['workspace:^', '^1.0.0'],
    ['workspace:~1.0.0', '~1.0.0'],
    ['workspace:^1.0.0', '^1.0.0'],
  ])('overrides %s dependency versions', (dependencyVersion, expectedPublishVersion) => {
    const { packageInfos, packageJsons } = createFullFixture({
      foo: { version: '1.0.0' },
      bar: { version: '2.0.0', dependencies: { foo: dependencyVersion } },
    });
    expect(packageJsons.bar.dependencies!.foo).toBe(dependencyVersion);

    performPublishOverrides(['bar'], packageInfos, undefined);

    expect(mockWriteJson).toHaveBeenCalledTimes(1);
    expect(mockWriteJson).toHaveBeenCalledWith(
      packageInfos.bar.packageJsonPath,
      expect.objectContaining({
        dependencies: { foo: expectedPublishVersion },
      })
    );
  });
});
