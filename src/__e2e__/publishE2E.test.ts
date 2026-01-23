import { describe, expect, it, afterEach, jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { addGitObserver, catalogsToYaml, clearGitObservers, type Catalogs } from 'workspace-tools';
import { generateChangeFiles, getChangeFiles } from '../__fixtures__/changeFiles';
import { defaultBranchName, defaultRemoteBranchName } from '../__fixtures__/gitDefaults';
import { initMockLogs } from '../__fixtures__/mockLogs';
import type { Repository } from '../__fixtures__/repository';
import { type PackageJsonFixture, type RepoFixture, RepositoryFactory } from '../__fixtures__/repositoryFactory';
import { publish } from '../commands/publish';
import type { ParsedOptions, RepoOptions } from '../types/BeachballOptions';
import { _mockNpmPublish, initNpmMock } from '../__fixtures__/mockNpm';
import type { PackageJson } from '../types/PackageInfo';
import { getParsedOptions } from '../options/getOptions';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import { validate } from '../validation/validate';
import { readJson } from '../object/readJson';
import { createCommandContext } from '../monorepo/createCommandContext';
import { deepFreezeProperties } from '../__fixtures__/object';

// Spawning actual npm to run commands against a fake registry is extremely slow, so mock it for
// this test (packagePublish covers the more complete npm registry scenario).
//
// If an issue is found in the future that could only be caught by this test using real npm,
// a new test file with a real registry should be created to cover that specific scenario.
jest.mock('../packageManager/npm');
// jest.mock('npm-registry-fetch');

describe('publish command (e2e)', () => {
  const npmMock = initNpmMock();

  let repositoryFactory: RepositoryFactory | undefined;
  let repo: Repository | undefined;

  // show error logs for these tests
  const logs = initMockLogs({ alsoLog: ['error'] });

  function getOptions(repoOptions?: Partial<RepoOptions>, extraArgv?: string[]) {
    const parsedOptions = getParsedOptions({
      cwd: repo!.rootPath,
      argv: ['node', 'beachball', 'publish', '--yes', ...(extraArgv || [])],
      testRepoOptions: {
        branch: defaultRemoteBranchName,
        registry: 'fake',
        message: 'apply package updates',
        tag: 'latest',
        access: 'public',
        ...repoOptions,
      },
    });
    return { options: parsedOptions.options, parsedOptions };
  }

  /**
   * For more realistic testing, call `validate()` like the CLI command does, then call `publish()`.
   * This helps catch any new issues with double bumps or context mutation.
   */
  async function publishWrapper(parsedOptions: ParsedOptions) {
    // This does an initial bump
    const { context } = validate(parsedOptions, { checkDependencies: true });
    // Ensure the later bump process does not modify the context
    deepFreezeProperties(context.bumpInfo);
    deepFreezeProperties(context.originalPackageInfos);
    await publish(parsedOptions.options, context);
    return context;
  }

  afterEach(() => {
    clearGitObservers();

    repositoryFactory?.cleanUp();
    repositoryFactory = undefined;
    repo = undefined;
  });

  it('publishes a single package', async () => {
    repositoryFactory = new RepositoryFactory('single');
    repo = repositoryFactory.cloneRepository();

    // Using fetch: false in tests where it's irrelevant should be a bit faster.
    // Use a git observer to verify that no fetch occurs.
    const { options, parsedOptions } = getOptions({ fetch: false });

    generateChangeFiles(['foo'], options);
    repo.push();

    let fetchCount = 0;
    addGitObserver(args => {
      args[0] === 'fetch' && fetchCount++;
    });

    await publishWrapper(parsedOptions);

    const publishedFoo = npmMock.getPublishedVersions('foo');
    expect(publishedFoo).toEqual({
      versions: ['1.1.0'],
      'dist-tags': { latest: '1.1.0' },
    });

    // no fetch when flag set to false
    expect(fetchCount).toBe(0);

    repo.checkout(defaultBranchName);
    repo.pull();
    expect(repo.getCurrentTags()).toEqual(['foo_v1.1.0']);

    // Also verify it's correct on disk
    const newPackageInfos = getPackageInfos(parsedOptions.cliOptions);
    expect(newPackageInfos.foo.version).toBe('1.1.0');
  });

  it('can perform a successful npm publish in detached HEAD', async () => {
    repositoryFactory = new RepositoryFactory('single');
    repo = repositoryFactory.cloneRepository();

    const { options, parsedOptions } = getOptions({
      push: false,
    });

    generateChangeFiles(['foo'], options);
    repo.push();

    repo.checkout('--detach');

    await publishWrapper(parsedOptions);

    expect(npmMock.getPublishedVersions('foo')).toEqual({
      versions: ['1.1.0'],
      'dist-tags': { latest: '1.1.0' },
    });
  });

  it('can perform a successful npm publish from a race condition', async () => {
    repositoryFactory = new RepositoryFactory('single');
    repo = repositoryFactory.cloneRepository();

    const { options, parsedOptions } = getOptions();

    generateChangeFiles(['foo'], options);
    repo.push();

    // Adds a step that injects a race condition
    let fetchCount = 0;

    addGitObserver(args => {
      if (args[0] === 'fetch') {
        if (fetchCount === 0) {
          const anotherRepo = repositoryFactory!.cloneRepository();
          // inject a checkin
          anotherRepo.updateJsonFile('package.json', { version: '1.0.2' });
          anotherRepo.push();
        }

        fetchCount++;
      }
    });

    await publishWrapper(parsedOptions);

    expect(npmMock.getPublishedVersions('foo')).toEqual({
      versions: ['1.1.0'],
      'dist-tags': { latest: '1.1.0' },
    });

    repo.checkout(defaultBranchName);
    repo.pull();
    expect(repo.getCurrentTags()).toEqual(['foo_v1.1.0']);

    // this indicates 2 tries
    expect(fetchCount).toBe(2);

    // TODO: this uses the modified version 1.0.2, which is wrong because the bumped version is newer.
    // Needs further investigation...
    // const newPackageInfos = getPackageInfos(parsedOptions.cliOptions);
    // expect(newPackageInfos.foo.version).toBe('1.1.0');
  });

  it('can perform a successful npm publish from a race condition in the dependencies', async () => {
    repositoryFactory = new RepositoryFactory('single');
    repo = repositoryFactory.cloneRepository();

    const { options, parsedOptions } = getOptions();

    generateChangeFiles(['foo'], options);
    repo.push();

    // Adds a step that injects a race condition
    let fetchCount = 0;

    addGitObserver(args => {
      if (args[0] === 'fetch') {
        if (fetchCount === 0) {
          const anotherRepo = repositoryFactory!.cloneRepository();
          // inject a checkin
          const packageJsonFile = anotherRepo.pathTo('package.json');
          const contents = readJson<PackageJson>(packageJsonFile);
          delete contents.dependencies?.baz;
          anotherRepo.commitChange('package.json', JSON.stringify(contents, null, 2));
          anotherRepo.push();
        }

        fetchCount++;
      }
    });

    await publishWrapper(parsedOptions);

    expect(npmMock.getPublishedVersions('foo')).toEqual({
      versions: ['1.1.0'],
      'dist-tags': { latest: '1.1.0' },
    });

    repo.checkout(defaultBranchName);
    repo.pull();
    expect(repo.getCurrentTags()).toEqual(['foo_v1.1.0']);

    // this indicates 2 tries
    expect(fetchCount).toBe(2);

    const newPackageInfos = getPackageInfos(parsedOptions.cliOptions);
    expect(newPackageInfos.foo.version).toBe('1.1.0');
    expect(newPackageInfos.foo.dependencies?.baz).toBeUndefined();
  });

  it('can perform a successful npm publish without bump', async () => {
    repositoryFactory = new RepositoryFactory('single');
    repo = repositoryFactory.cloneRepository();

    const { options, parsedOptions } = getOptions({ bump: false, fetch: false });

    generateChangeFiles(['foo'], options);
    repo.push();

    await publishWrapper(parsedOptions);

    expect(npmMock.getPublishedVersions('foo')).toEqual({
      versions: ['1.0.0'],
      'dist-tags': { latest: '1.0.0' },
    });

    repo.checkout(defaultBranchName);
    repo.pull();
    expect(repo.getCurrentTags()).toEqual([]);

    const newPackageInfos = getPackageInfos(parsedOptions.cliOptions);
    expect(newPackageInfos.foo.version).toBe('1.0.0');
  });

  it('publishes changed and dependent packages in a monorepo', async () => {
    repositoryFactory = new RepositoryFactory('monorepo');
    repo = repositoryFactory.cloneRepository();

    const { options, parsedOptions } = getOptions({ fetch: false });

    // bump baz => dependent bump bar => dependent bump foo
    generateChangeFiles(['baz'], options);
    expect(repositoryFactory.fixture.folders.packages.foo.dependencies!.bar).toBeTruthy();
    expect(repositoryFactory.fixture.folders.packages.bar.dependencies!.baz).toBeTruthy();
    repo.push();

    // For this test, run validate first to simulate what the CLI does
    validate(parsedOptions, { checkDependencies: true });

    await publishWrapper(parsedOptions);

    expect(npmMock.getPublishedVersions('baz')).toEqual({ versions: ['1.4.0'], 'dist-tags': { latest: '1.4.0' } });

    expect(npmMock.getPublishedVersions('bar')).toEqual({ versions: ['1.3.5'], 'dist-tags': { latest: '1.3.5' } });
    expect(npmMock.getPublishedPackage('bar')).toMatchObject({ version: '1.3.5', dependencies: { baz: '^1.4.0' } });

    expect(npmMock.getPublishedVersions('foo')).toEqual({ versions: ['1.0.1'], 'dist-tags': { latest: '1.0.1' } });
    expect(npmMock.getPublishedPackage('foo')).toMatchObject({ version: '1.0.1', dependencies: { bar: '^1.3.5' } });

    repo.checkout(defaultBranchName);
    repo.pull();
    expect(repo.getCurrentTags()).toEqual(['bar_v1.3.5', 'baz_v1.4.0', 'foo_v1.0.1']);

    const newPackageInfos = getPackageInfos(parsedOptions.cliOptions);
    expect(newPackageInfos.foo).toMatchObject({ version: '1.0.1', dependencies: { bar: '^1.3.5' } });
    expect(newPackageInfos.bar).toMatchObject({ version: '1.3.5', dependencies: { baz: '^1.4.0' } });
    expect(newPackageInfos.baz.version).toBe('1.4.0');
  });

  it('publishes new monorepo packages if requested', async () => {
    // use a slightly smaller fixture to only publish one extra package
    repositoryFactory = new RepositoryFactory({
      folders: {
        packages: { foo: { version: '1.0.0' }, bar: { version: '1.3.4' } },
      },
    });
    repo = repositoryFactory.cloneRepository();

    const { options, parsedOptions } = getOptions({ new: true, fetch: false });

    generateChangeFiles(['foo'], options);
    repo.push();

    await publishWrapper(parsedOptions);

    expect(npmMock.getPublishedVersions('foo')).toEqual({ versions: ['1.1.0'], 'dist-tags': { latest: '1.1.0' } });
    expect(npmMock.getPublishedVersions('bar')).toEqual({ versions: ['1.3.4'], 'dist-tags': { latest: '1.3.4' } });

    repo.checkout(defaultBranchName);
    repo.pull();
    expect(repo.getCurrentTags()).toEqual(['bar_v1.3.4', 'foo_v1.1.0']);
  });

  it('does not publish an out-of-scope package', async () => {
    repositoryFactory = new RepositoryFactory('monorepo');
    repo = repositoryFactory.cloneRepository();

    const { options, parsedOptions } = getOptions({
      scope: ['!packages/foo'],
      fetch: false,
    });

    generateChangeFiles(['foo', 'bar'], options);
    expect(getChangeFiles(options)).toHaveLength(2);
    repo.push();

    await publishWrapper(parsedOptions);

    expect(npmMock.getPublishedVersions('foo')).toBeUndefined();
    expect(npmMock.getPublishedVersions('bar')).toEqual({
      versions: ['1.4.0'],
      'dist-tags': { latest: '1.4.0' },
    });

    repo.checkout(defaultBranchName);
    repo.pull();
    expect(repo.getCurrentTags()).toEqual(['bar_v1.4.0']);

    const newPackageInfos = getPackageInfos(parsedOptions.cliOptions);
    expect(newPackageInfos.bar.version).toBe('1.4.0');
    expect(newPackageInfos.foo.version).toBe('1.0.0');
  });

  // Combine workspace/catalog/file cases since these tests are slow
  it('publishes packages with workspace: and catalog: deps and replaces versions', async () => {
    const monorepo: RepoFixture['folders'] = {
      packages: {
        // Include some external deps to make sure nothing weird happens there
        'pkg-1': { version: '1.0.0', dependencies: { extra: '~1.2.3' } },
        'pkg-2': { version: '1.0.0', dependencies: { 'pkg-1': 'workspace:~', react: 'catalog:react18' } },
        'pkg-3': { version: '1.0.0', dependencies: { 'pkg-2': 'workspace:^1.0.0', other: 'npm:lodash' } },
        'pkg-4': {
          version: '1.0.0',
          dependencies: { 'pkg-1': 'catalog:' },
          devDependencies: { 'pkg-2': 'file:../pkg-2' },
        },
      },
    };
    const catalogs: Catalogs = {
      default: { 'pkg-1': 'workspace:~' }, // only yarn supports workspace: inside catalog
      named: { react18: { react: '^18.0.0' } },
    };
    repositoryFactory = new RepositoryFactory({
      folders: monorepo,
      extraFiles: { '.yarnrc.yml': catalogsToYaml(catalogs) },
    });
    repo = repositoryFactory.cloneRepository();

    const { options, parsedOptions } = getOptions({ bumpDeps: true, fetch: false });
    generateChangeFiles([{ packageName: 'pkg-1', type: 'minor' }], options);
    repo.push();

    const { originalPackageInfos } = await publishWrapper(parsedOptions);
    repo.checkout(defaultBranchName);
    repo.pull();

    expect(repo.getCurrentTags()).toEqual(['pkg-1_v1.1.0', 'pkg-2_v1.0.1', 'pkg-3_v1.0.1', 'pkg-4_v1.0.1']);

    // All the dependent packages are bumped despite the workspace: dep specs.
    // The literal workspace: specs are preserved in git.
    const packageInfos = getPackageInfos(parsedOptions.cliOptions);
    expect(packageInfos['pkg-1']).toEqual({ ...originalPackageInfos['pkg-1'], version: '1.1.0' });
    // workspace:~ and catalog: ranges aren't changed
    expect(packageInfos['pkg-2']).toEqual({ ...originalPackageInfos['pkg-2'], version: '1.0.1' });
    expect(packageInfos['pkg-2'].version).toBe('1.0.1');
    // workspace: range with number is updated
    expect(packageInfos['pkg-3']).toEqual({
      ...originalPackageInfos['pkg-3'],
      version: '1.0.1',
      dependencies: { 'pkg-2': 'workspace:^1.0.1', other: 'npm:lodash' },
    });
    // catalog: range isn't changed
    expect(packageInfos['pkg-4']).toEqual({ ...originalPackageInfos['pkg-4'], version: '1.0.1' });

    // The changelogs are adequately covered by the similar bump test.

    // Verify that the published packages have the actual resolved versions
    expect(npmMock.getPublishedPackage('pkg-1')).toMatchObject({ version: '1.1.0' });
    expect(npmMock.getPublishedPackage('pkg-2')).toMatchObject({
      version: '1.0.1',
      dependencies: { 'pkg-1': '~1.1.0', react: '^18.0.0' },
    });
    expect(npmMock.getPublishedPackage('pkg-3')).toMatchObject({
      version: '1.0.1',
      dependencies: { 'pkg-2': '^1.0.1', other: 'npm:lodash' },
    });
    expect(npmMock.getPublishedPackage('pkg-4')).toMatchObject({
      version: '1.0.1',
      dependencies: { 'pkg-1': '~1.1.0' },
      // file: deps aren't currently replaced (definitely fine for dev deps, questionable for prod)
      devDependencies: { 'pkg-2': 'file:../pkg-2' },
    });
  });

  // These tests are slow, so combine pre and post hooks
  it('respects prepublish/postpublish hooks', async () => {
    repositoryFactory = new RepositoryFactory('monorepo');
    repo = repositoryFactory.cloneRepository();

    type ExtraPackageJson = PackageJson & {
      customOnPublish?: { main: string };
      customAfterPublish?: { notify: string };
    };
    const fooJsonRelative = 'packages/foo/package.json';
    const fooJsonPath = repo.pathTo(fooJsonRelative);
    const fooJsonPre = readJson<ExtraPackageJson>(fooJsonPath);
    fooJsonPre.customOnPublish = { main: 'lib/index.js' };
    fooJsonPre.customAfterPublish = { notify: 'message' };
    repo.commitChange(fooJsonRelative, fooJsonPre);

    let notified: string | undefined;

    const { options, parsedOptions } = getOptions({
      fetch: false,
      hooks: {
        prepublish: (packagePath, name, version) => {
          const packageJsonPath = path.join(packagePath, 'package.json');
          const packageJson = readJson<ExtraPackageJson>(packageJsonPath);
          if (name === 'foo') {
            expect(version).toBe('1.1.0');
            expect(packageJson.version).toBe('1.1.0'); // bumped version
          }
          if (packageJson.customOnPublish) {
            Object.assign(packageJson, packageJson.customOnPublish);
            delete packageJson.customOnPublish;
            fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
          }
        },
        postpublish: packagePath => {
          const packageJsonPath = path.join(packagePath, 'package.json');
          const packageJson = readJson<ExtraPackageJson>(packageJsonPath);
          if (packageJson.customAfterPublish) {
            notified = packageJson.customAfterPublish.notify;
          }
        },
      },
    });

    generateChangeFiles(['foo'], options);
    repo.push();

    await publishWrapper(parsedOptions);

    // Query the information from package.json from the registry to see if it was successfully patched
    const publishedFooJson = npmMock.getPublishedPackage('foo')!;
    expect(publishedFooJson.main).toEqual('lib/index.js');
    expect(publishedFooJson).not.toHaveProperty('customOnPublish');
    expect(publishedFooJson).toHaveProperty('customAfterPublish');

    repo.checkout(defaultBranchName);
    repo.pull();

    // All git results should still have previous information
    expect(repo.getCurrentTags()).toEqual(['foo_v1.1.0']);
    const fooJsonPost = readJson<ExtraPackageJson>(fooJsonPath);
    expect(fooJsonPost.main).toBe('src/index.ts');
    expect(fooJsonPost.customOnPublish?.main).toBe('lib/index.js');
    expect(notified).toBe(fooJsonPost.customAfterPublish?.notify);
  });

  it('respects concurrency limit when publishing multiple packages', async () => {
    const packagesToPublish = ['pkg1', 'pkg2', 'pkg3', 'pkg4', 'pkg5'];
    const packages: { [packageName: string]: PackageJsonFixture } = {};
    for (const name of packagesToPublish) {
      packages[name] = { version: '1.0.0' };
    }

    repositoryFactory = new RepositoryFactory({
      folders: {
        packages: packages,
      },
    });
    repo = repositoryFactory.cloneRepository();

    // Skip fetching and pushing since it's slow and not important for this test
    const concurrency = 2;
    const { options, parsedOptions } = getOptions({ concurrency, fetch: false, push: false });
    generateChangeFiles(packagesToPublish, options);

    const simulateWait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    let currentConcurrency = 0;
    let maxConcurrency = 0;
    npmMock.setCommandOverride('publish', async (registryData, args, opts) => {
      currentConcurrency++;
      await simulateWait(100);
      const result = await _mockNpmPublish(registryData, args, opts);
      maxConcurrency = Math.max(maxConcurrency, currentConcurrency);
      currentConcurrency--;
      return result;
    });

    // skip validate for this test since it's not relevant
    await publish(options, createCommandContext(parsedOptions));
    // Verify that at most `concurrency` number of packages were published concurrently
    expect(maxConcurrency).toBe(concurrency);

    // Verify all packages were published
    for (const pkg of packagesToPublish) {
      expect(npmMock.getPublishedVersions(pkg)).toEqual({
        versions: ['1.1.0'],
        'dist-tags': { latest: '1.1.0' },
      });
    }
  });

  it('handles errors correctly when one package fails during concurrent publishing', async () => {
    logs.setOverrideOptions({ alsoLog: [] });
    const packageNames = ['pkg1', 'pkg2', 'pkg3', 'pkg4', 'pkg5'];
    const packages: { [packageName: string]: PackageJsonFixture } = {};
    const packageToFail = 'pkg3';
    for (const name of packageNames) {
      packages[name] = { version: '1.0.0' };
    }
    packages['pkg1'].dependencies = { [packageToFail]: '1.0.0' };
    packages['pkg2'].dependencies = { [packageToFail]: '1.0.0' };

    repositoryFactory = new RepositoryFactory({
      folders: { packages },
    });
    repo = repositoryFactory.cloneRepository();

    const { options, parsedOptions } = getOptions({
      concurrency: 3,
      // Skip fetching and pushing since it's slow and not important for this test
      fetch: false,
      push: false,
    });
    generateChangeFiles(packageNames, options);

    npmMock.setCommandOverride('publish', async (registryData, args, opts) => {
      if (opts.cwd?.endsWith(packageToFail)) {
        const stderr = 'Failed to publish package';
        return { failed: true, stderr, stdout: '', success: false, all: stderr };
      }
      return _mockNpmPublish(registryData, args, opts);
    });

    // skip validate for this test since it's not relevant
    await expect(publish(options, createCommandContext(parsedOptions))).rejects.toThrow(
      'Error publishing! Refer to the previous logs for recovery instructions.'
    );

    for (const name of packageNames) {
      if (['pkg1', 'pkg2', packageToFail].includes(name)) {
        // Verify that the packages that failed to publish are not published.
        // pkg1 and pkg2 are not published because they depend on pkg3, which failed to publish.
        expect(npmMock.getPublishedVersions(name)).toBeUndefined();
      } else {
        // Verify that the packages that did not fail to publish are published
        expect(npmMock.getPublishedVersions(name)).toEqual({
          versions: ['1.1.0'],
          'dist-tags': { latest: '1.1.0' },
        });
      }
    }
  });

  // Just test postpublish (prepublish should have the same logic)
  // TODO: possibly move to in-memory test
  it('respects concurrency limit for publish hooks', async () => {
    const packagesToPublish = ['pkg1', 'pkg2', 'pkg3', 'pkg4'];
    type ExtraPackageJsonFixture = PackageJsonFixture & { customAfterPublish?: { notify: string } };
    const packages: { [packageName: string]: ExtraPackageJsonFixture } = {};
    for (const name of packagesToPublish) {
      packages[name] = {
        version: '1.0.0',
        customAfterPublish: {
          notify: `message-${name}`,
        },
      };
    }

    repositoryFactory = new RepositoryFactory({
      folders: { packages },
    });
    repo = repositoryFactory.cloneRepository();

    const simulateWait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const afterPublishStrings: Record<string, string | undefined> = {};
    const concurrency = 2;
    let currentConcurrency = 0;
    let maxConcurrency = 0;
    const { options, parsedOptions } = getOptions({
      hooks: {
        postpublish: async (packagePath, name) => {
          currentConcurrency++;
          await simulateWait(100);
          const packageJsonPath = path.join(packagePath, 'package.json');
          const packageJson = readJson<ExtraPackageJsonFixture>(packageJsonPath);
          afterPublishStrings[name] = packageJson.customAfterPublish?.notify;
          maxConcurrency = Math.max(maxConcurrency, currentConcurrency);
          currentConcurrency--;
        },
      },
      concurrency,
      // Skip fetching and pushing since it's slow and not important for this test
      fetch: false,
      push: false,
    });

    generateChangeFiles(packagesToPublish, options);

    // skip validate for this test since it's not relevant
    await publish(options, createCommandContext(parsedOptions));
    // Verify that at most `concurrency` number of postpublish hooks were running concurrently
    expect(maxConcurrency).toBe(concurrency);

    for (const pkg of packagesToPublish) {
      const packageJson = readJson<ExtraPackageJsonFixture>(repo.pathTo(`packages/${pkg}/package.json`));
      if (packageJson.customAfterPublish) {
        // Verify that all postpublish hooks were called
        expect(afterPublishStrings[pkg]).toEqual(packageJson.customAfterPublish.notify);
      }
    }
  });
});
