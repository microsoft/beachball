import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { _mockNpmPublish, getMockNpmPackName, initNpmMock } from '../../__fixtures__/mockNpm';
import { makePackageInfos } from '../../__fixtures__/packageInfos';
import { removeTempDir, tmpdir } from '../../__fixtures__/tmpdir';
import { writeJson } from '../../object/writeJson';
import { getDefaultOptions } from '../../options/getDefaultOptions';
import { publishToRegistry } from '../../publish/publishToRegistry';
import type { BeachballOptions, HooksOptions } from '../../types/BeachballOptions';
import type { PublishBumpInfo } from '../../types/BumpInfo';
import type { PackageJson } from '../../types/PackageInfo';

// Mock npm calls (publish, pack, show)
jest.mock('../../packageManager/npm');

describe('publishToRegistry', () => {
  const npmMock = initNpmMock();
  const logs = initMockLogs();

  let tempRoot: string;
  let defaultOptions: BeachballOptions;

  beforeEach(() => {
    tempRoot = tmpdir();
    defaultOptions = {
      ...getDefaultOptions(),
      path: tempRoot,
      registry: 'http://localhost:99999',
      bump: false,
    };
  });

  afterEach(() => {
    removeTempDir(tempRoot);
  });

  /** Create a minimal PublishBumpInfo where all packages are modified and in scope */
  function makeBumpInfo(
    partialPackageInfos: Parameters<typeof makePackageInfos>[0],
    extra?: Partial<Pick<PublishBumpInfo, 'modifiedPackages' | 'calculatedChangeTypes' | 'scopedPackages'>>
  ): PublishBumpInfo {
    const packageInfos = makePackageInfos(partialPackageInfos, { path: tempRoot });

    // Write package.json files to disk so mock npm publish can read them
    for (const info of Object.values(packageInfos)) {
      const { packageJsonPath, ...json } = info;
      fs.mkdirSync(path.dirname(packageJsonPath), { recursive: true });
      writeJson(packageJsonPath, json);
    }

    const names = Object.keys(packageInfos);
    return {
      changeFileChangeInfos: [],
      packageInfos,
      calculatedChangeTypes: Object.fromEntries(names.map(n => [n, 'patch' as const])),
      packageGroups: {},
      modifiedPackages: new Set(names),
      dependentChangedBy: {},
      scopedPackages: new Set(names),
      ...extra,
    };
  }

  it('publishes a single package', async () => {
    const bumpInfo = makeBumpInfo({ foo: {} });

    await publishToRegistry(bumpInfo, defaultOptions);

    const published = npmMock.getPublishedVersions('foo');
    expect(published?.versions).toEqual(['1.0.0']);

    // This is like a visual regression test for the log UX
    expect(logs.getMockLines('all', { root: tempRoot })).toMatchInlineSnapshot(`
      "[log] Validating new package versions...

      [log] Package versions are OK to publish:
        • foo@1.0.0

      [log] Validating no private package among package dependencies
      [log]   OK!

      [log] Publishing - foo@1.0.0 with tag latest
      [log]   publish command: publish --registry http://localhost:99999 --tag latest --loglevel warn
      [log]   (cwd: <root>/packages/foo)

      [log] Published! - foo@1.0.0"
    `);
  });

  it('publishes multiple packages in dependency order', async () => {
    const bumpInfo = makeBumpInfo({
      app: { dependencies: { lib: '1.0.0' } },
      lib: {},
    });

    await publishToRegistry(bumpInfo, defaultOptions);

    // Both packages should be published
    expect(npmMock.getPublishedVersions('lib')?.versions).toEqual(['1.0.0']);
    expect(npmMock.getPublishedVersions('app')?.versions).toEqual(['1.0.0']);

    // lib should be published before app (check npm call order)
    const publishCalls = npmMock.mock.mock.calls.filter(([args]) => args[0] === 'publish');
    const publishOrder = publishCalls.map(([, opts]) => path.basename(opts.cwd!));
    expect(publishOrder).toEqual(['lib', 'app']);

    expect(logs.getMockLines('all', { root: tempRoot })).toMatchSnapshot();
  });

  it('skips private packages', async () => {
    const bumpInfo = makeBumpInfo({
      foo: {},
      'private-pkg': { private: true },
    });

    await publishToRegistry(bumpInfo, defaultOptions);

    expect(npmMock.getPublishedVersions('foo')?.versions).toEqual(['1.0.0']);
    expect(npmMock.getPublishedVersions('private-pkg')).toBeUndefined();

    expect(logs.getMockLines('all', { root: tempRoot })).toMatchSnapshot();
  });

  it('returns early when no packages need publishing', async () => {
    const bumpInfo = makeBumpInfo({ foo: { private: true } }, { calculatedChangeTypes: { foo: 'none' } });

    await publishToRegistry(bumpInfo, defaultOptions);

    // No npm calls should have been made
    expect(npmMock.mock).not.toHaveBeenCalled();

    expect(logs.getMockLines('all', { root: tempRoot })).toMatchInlineSnapshot(`
      "[log] Skipping publishing the following packages:
        • foo has change type none

      [log] Nothing to publish"
    `);
  });

  it('throws on publish failure', async () => {
    const bumpInfo = makeBumpInfo({ foo: {} });

    // Make the publish command fail
    npmMock.setCommandOverride('publish', () =>
      Promise.resolve({ success: false, stdout: '', stderr: 'network error', all: 'network error', failed: true })
    );

    await expect(publishToRegistry(bumpInfo, defaultOptions)).rejects.toThrow('Error publishing');

    expect(logs.getMockLines('all', { root: tempRoot })).toMatchSnapshot();
  });

  it('exits on validation failure when version already exists', async () => {
    const bumpInfo = makeBumpInfo({ foo: {} });

    // Pre-populate registry so version 1.0.0 already exists
    npmMock.setRegistryData({ foo: { versions: ['1.0.0'] } });

    // process.exit is mocked in jestSetup.js to throw
    await expect(publishToRegistry(bumpInfo, defaultOptions)).rejects.toThrow('process.exit called with code 1');

    expect(logs.getMockLines('all')).toMatchInlineSnapshot(`
      "[log] Validating new package versions...

      [error] ERROR: Attempting to publish package versions that already exist in the registry:
        • foo@1.0.0

      [error] Something went wrong with publishing (see above for details). The following packages were NOT published:
        • foo@1.0.0"
    `);
  });

  it('applies publishConfig overrides before publishing', async () => {
    const bumpInfo = makeBumpInfo({ foo: {} });
    // Add main and publishConfig on disk (would be stripped by makePackageInfos)
    const { packageJsonPath, ...json } = bumpInfo.packageInfos.foo;
    const allJson: PackageJson = { ...json, main: 'src/index.js', publishConfig: { main: 'dist/index.js' } };
    fs.writeFileSync(packageJsonPath, JSON.stringify(allJson));

    await publishToRegistry(bumpInfo, defaultOptions);

    // performPublishOverrides should have replaced `main` from publishConfig
    const packageJson = JSON.parse(fs.readFileSync(bumpInfo.packageInfos.foo.packageJsonPath, 'utf-8')) as PackageJson;
    expect(packageJson).toMatchObject(allJson.publishConfig!);
  });

  it('calls prepublish and postpublish hooks', async () => {
    const bumpInfo = makeBumpInfo({ foo: {}, bar: {} });

    const prepublish = jest.fn<Required<HooksOptions>['prepublish']>();
    const postpublish = jest.fn<Required<HooksOptions>['postpublish']>();

    await publishToRegistry(bumpInfo, { ...defaultOptions, hooks: { prepublish, postpublish } });

    // Verify hook calls and arguments
    const expectHookCalls = (hook: typeof prepublish) => {
      expect(hook).toHaveBeenCalledTimes(2);
      expect(hook).toHaveBeenCalledWith(expect.stringMatching(/packages[\\/]foo$/), 'foo', '1.0.0', expect.anything());
      expect(hook).toHaveBeenCalledWith(expect.stringMatching(/packages[\\/]bar$/), 'bar', '1.0.0', expect.anything());
    };
    expectHookCalls(prepublish);
    expectHookCalls(postpublish);
  });

  describe('with concurrency > 1', () => {
    it('publishes independent packages in parallel', async () => {
      const bumpInfo = makeBumpInfo({ foo: {}, bar: {}, baz: {}, qux: {}, quux: {} });

      const concurrency = 3;
      let currentConcurrency = 0;
      let maxConcurrency = 0;

      npmMock.setCommandOverride('publish', async (registryData, args, opts) => {
        currentConcurrency++;
        await new Promise(resolve => setTimeout(resolve, 50));
        const result = await _mockNpmPublish(registryData, args, opts);
        maxConcurrency = Math.max(maxConcurrency, currentConcurrency);
        currentConcurrency--;
        return result;
      });

      await publishToRegistry(bumpInfo, { ...defaultOptions, concurrency });

      // Verify that at most `concurrency` number of packages were published concurrently
      expect(maxConcurrency).toBe(concurrency);

      expect(npmMock.getPublishedVersions('foo')?.versions).toEqual(['1.0.0']);
      expect(npmMock.getPublishedVersions('bar')?.versions).toEqual(['1.0.0']);
      expect(npmMock.getPublishedVersions('baz')?.versions).toEqual(['1.0.0']);
      expect(npmMock.getPublishedVersions('qux')?.versions).toEqual(['1.0.0']);
      expect(npmMock.getPublishedVersions('quux')?.versions).toEqual(['1.0.0']);

      // If this turns out to be unstable, it can be removed
      expect(logs.getMockLines('all', { root: tempRoot })).toMatchSnapshot();
    });

    // Just test postpublish (prepublish should have the same logic)
    it('respects concurrency limit for publish hooks', async () => {
      const bumpInfo = makeBumpInfo({ pkg1: {}, pkg2: {}, pkg3: {}, pkg4: {} });
      const concurrency = 2;

      let currentConcurrency = 0;
      let maxConcurrency = 0;
      const hookNames: string[] = [];

      const postpublish = async (_packagePath: string, name: string) => {
        currentConcurrency++;
        await new Promise(resolve => setTimeout(resolve, 50));
        hookNames.push(name);
        maxConcurrency = Math.max(maxConcurrency, currentConcurrency);
        currentConcurrency--;
      };

      await publishToRegistry(bumpInfo, { ...defaultOptions, concurrency, hooks: { postpublish } });

      expect(maxConcurrency).toBe(concurrency);
      expect(hookNames.sort()).toEqual(['pkg1', 'pkg2', 'pkg3', 'pkg4']);
    });

    it('throws and shows recovery info on failure', async () => {
      const bumpInfo = makeBumpInfo({
        pkg1: { dependencies: { pkg2: '1.0.0' } },
        pkg2: { dependencies: { pkg3: '1.0.0' } },
        pkg3: {},
        pkg4: {},
        pkg5: {},
      });

      // Make publish fail for pkg2 and pkg5.
      // pkg3 and pkg4 should succeed, and pkg1 should be skipped.
      npmMock.setCommandOverride('publish', async (registryData, args, opts) => {
        const packageName = path.basename(opts.cwd!);
        if (packageName === 'pkg2' || packageName === 'pkg5') {
          return { success: false, stdout: '', stderr: 'oh no', all: 'oh no', failed: true };
        }
        // Use a small delay to verify that the started tasks are awaited even if others fail
        await new Promise(resolve => setTimeout(resolve, 20));
        return _mockNpmPublish(registryData, args, opts);
      });

      // Set concurrency to 4 so pkg2-5 will start in parallel (leading to two failures)
      await expect(publishToRegistry(bumpInfo, { ...defaultOptions, concurrency: 4 }))
        .rejects // The message should be deduplicated since the same error is thrown for both failures
        .toThrowErrorMatchingInlineSnapshot(
          `"Error publishing! Refer to the previous logs for recovery instructions."`
        );

      expect(npmMock.getPublishedVersions('pkg1')).toBeUndefined();
      expect(npmMock.getPublishedVersions('pkg2')).toBeUndefined();
      expect(npmMock.getPublishedVersions('pkg3')?.versions).toEqual(['1.0.0']);
      expect(npmMock.getPublishedVersions('pkg4')?.versions).toEqual(['1.0.0']);
      expect(npmMock.getPublishedVersions('pkg5')).toBeUndefined();

      // If this turns out to be unstable, it can be replaced with more granular tests
      // (need to verify that all failed packages' logs are shown, and the final errors are aggregated
      // in a reasonable manner)
      expect(logs.getMockLines('all', { root: tempRoot })).toMatchSnapshot();
    });
  });

  describe('with packToPath', () => {
    let packToPath: string;

    beforeEach(() => {
      packToPath = tmpdir();
    });

    afterEach(() => {
      removeTempDir(packToPath);
    });

    it('packs packages', async () => {
      const bumpInfo = makeBumpInfo({
        app: { dependencies: { lib: '1.0.0' } },
        lib: {},
      });

      await publishToRegistry(bumpInfo, { ...defaultOptions, packToPath });

      // Nothing should be published to the registry
      expect(npmMock.getPublishedVersions('lib')).toBeUndefined();
      expect(npmMock.getPublishedVersions('app')).toBeUndefined();

      // Tgz files should be in packToPath with numeric prefixes (toposorted: lib=1, app=2)
      const files = fs.readdirSync(packToPath).sort();
      expect(files).toEqual([
        `1-${getMockNpmPackName(bumpInfo.packageInfos.lib)}`,
        `2-${getMockNpmPackName(bumpInfo.packageInfos.app)}`,
      ]);

      expect(
        logs.getMockLines('all', { replacePaths: { [tempRoot]: '<root>', [packToPath]: '<packPath>' } })
      ).toMatchSnapshot();
    });

    it('throws with packing error message on pack failure', async () => {
      const bumpInfo = makeBumpInfo({ foo: {} });

      npmMock.setCommandOverride('pack', () =>
        Promise.resolve({ success: false, stdout: '', stderr: 'pack error', all: 'pack error', failed: true })
      );

      await expect(publishToRegistry(bumpInfo, { ...defaultOptions, packToPath })).rejects.toThrow('Error packing');

      expect(logs.getMockLines('error')).toMatch('Something went wrong with packing packages!');

      expect(
        logs.getMockLines('all', { replacePaths: { [tempRoot]: '<root>', [packToPath]: '<packPath>' } })
      ).toMatchSnapshot();
    });
  });
});
