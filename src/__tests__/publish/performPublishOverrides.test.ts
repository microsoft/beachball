import { describe, expect, it, afterEach, jest } from '@jest/globals';
import { performPublishOverrides } from '../../publish/performPublishOverrides';
import type { PackageInfos, PackageJson, PublishConfig } from '../../types/PackageInfo';
import { makePackageInfos, type PartialPackageInfos } from '../../__fixtures__/packageInfos';
import * as readJsonModule from '../../object/readJson';
import * as writeJsonModule from '../../object/writeJson';

jest.mock('../../object/readJson');
jest.mock('../../object/writeJson');

describe('performPublishOverrides', () => {
  const readJSONSync = readJsonModule.readJson as jest.MockedFunction<typeof readJsonModule.readJson>;
  const writeJSONSync = writeJsonModule.writeJson as jest.MockedFunction<typeof writeJsonModule.writeJson>;

  afterEach(() => {
    // clear the implementations and calls for read/writeJSONSync
    jest.resetAllMocks();
  });

  function createFixture(partialPackageJsons: Record<string, Partial<PackageJson>>): {
    packageInfos: PackageInfos;
    packageJsons: Record<string, PackageJson>;
  } {
    const partialInfos: PartialPackageInfos = {};
    for (const [name, json] of Object.entries(partialPackageJsons)) {
      partialInfos[name] = {
        packageJsonPath: `packages/${name}/package.json`,
        version: json.version || '1.0.0',
        dependencies: json.dependencies || {},
      };
    }
    const packageInfos = makePackageInfos(partialInfos);

    const packageJsons: Record<string, PackageJson> = {};
    for (const [name, json] of Object.entries(partialPackageJsons)) {
      packageJsons[name] = {
        name,
        version: packageInfos[name].version,
        // these values can potentially be overridden by publishConfig
        main: 'src/index.ts',
        bin: 'src/foo-bin.ts',
        ...json,
      };
    }

    readJSONSync.mockImplementation((path => {
      for (const pkg of Object.values(packageInfos)) {
        if (path === pkg.packageJsonPath) {
          // performPublishConfigOverrides mutates the packageJson, so we need to clone it to
          // simulate reading the file from the disk and avoid mutating original fixtures.
          // This is also just safer in general for tests that use this method for before/after comparisons.
          return JSON.parse(JSON.stringify(packageJsons[pkg.name])) as PackageJson;
        }
      }
      throw new Error(`not found: ${path}`);
    }) as typeof readJsonModule.readJson);

    return { packageInfos, packageJsons };
  }

  it('overrides accepted publishConfig keys and preserves values not specified', () => {
    const publishConfig: PublishConfig = {
      main: 'lib/index.js',
      types: 'lib/index.d.ts',
    };
    const { packageInfos, packageJsons } = createFixture({ foo: { publishConfig } });
    expect(packageJsons.foo).not.toMatchObject(publishConfig);

    performPublishOverrides(['foo'], packageInfos);

    expect(writeJSONSync).toHaveBeenCalledTimes(1);
    expect(publishConfig).toEqual({
      main: 'lib/index.js',
      types: 'lib/index.d.ts',
    });
    expect(writeJSONSync).toHaveBeenCalledWith(
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
    const { packageInfos, packageJsons } = createFixture({ foo: { publishConfig } });
    expect(packageJsons.foo).not.toMatchObject(publishConfig);

    performPublishOverrides(['foo'], packageInfos);

    expect(writeJSONSync).toHaveBeenCalledTimes(1);
    expect(writeJSONSync).toHaveBeenCalledWith(packageInfos.foo.packageJsonPath, packageJsons.foo);
  });

  it('performs publish overrides for multiple packages', () => {
    const { packageInfos, packageJsons } = createFixture({
      foo: { publishConfig: { main: 'lib/index.js' } },
      bar: { publishConfig: { types: 'lib/index.d.ts' } },
    });
    const originalFoo = packageJsons.foo;
    const originalBar = packageJsons.bar;
    expect(originalFoo).not.toMatchObject(originalFoo.publishConfig!);
    expect(originalBar).not.toMatchObject(originalBar.publishConfig!);

    performPublishOverrides(['foo', 'bar'], packageInfos);

    expect(writeJSONSync).toHaveBeenCalledTimes(2);
    expect(writeJSONSync).toHaveBeenCalledWith(packageInfos.foo.packageJsonPath, {
      ...originalFoo,
      ...originalFoo.publishConfig,
      publishConfig: {},
    });
    expect(writeJSONSync).toHaveBeenCalledWith(packageInfos.bar.packageJsonPath, {
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
    const { packageInfos, packageJsons } = createFixture({
      foo: { version: '1.0.0' },
      bar: { version: '2.0.0', dependencies: { foo: dependencyVersion } },
    });
    expect(packageJsons.bar.dependencies!.foo).toBe(dependencyVersion);

    performPublishOverrides(['bar'], packageInfos);

    expect(writeJSONSync).toHaveBeenCalledTimes(1);
    expect(writeJSONSync).toHaveBeenCalledWith(
      packageInfos.bar.packageJsonPath,
      expect.objectContaining({
        dependencies: { foo: expectedPublishVersion },
      })
    );
  });
});
