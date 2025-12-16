import { describe, expect, it, afterEach, jest } from '@jest/globals';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { addGitObserver, clearGitObservers } from 'workspace-tools';
import { generateChangeFiles, getChangeFiles } from '../__fixtures__/changeFiles';
import { defaultBranchName, defaultRemoteBranchName } from '../__fixtures__/gitDefaults';
import { initMockLogs } from '../__fixtures__/mockLogs';
import type { Repository } from '../__fixtures__/repository';
import { type PackageJsonFixture, RepositoryFactory } from '../__fixtures__/repositoryFactory';
import { publish } from '../commands/publish';
import type { RepoOptions } from '../types/BeachballOptions';
import { _mockNpmPublish, initNpmMock } from '../__fixtures__/mockNpm';
import type { PackageJson } from '../types/PackageInfo';
import { getParsedOptions } from '../options/getOptions';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import { validate } from '../validation/validate';
import { readJson } from '../object/readJson';

// Spawning actual npm to run commands against a fake registry is extremely slow, so mock it for
// this test (packagePublish covers the more complete npm registry scenario).
//
// If an issue is found in the future that could only be caught by this test using real npm,
// a new test file with a real registry should be created to cover that specific scenario.
jest.mock('../packageManager/npm');
jest.mock('npm-registry-fetch');

describe('publish command (e2e)', () => {
  const npmMock = initNpmMock();

  let repositoryFactory: RepositoryFactory | undefined;
  let repo: Repository | undefined;

  // show error logs for these tests
  const logs = initMockLogs({ alsoLog: ['error'] });

  function getOptionsAndPackages(repoOptions?: Partial<RepoOptions>, extraArgv?: string[]) {
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
    const packageInfos = getPackageInfos(parsedOptions);
    return { packageInfos, options: parsedOptions.options, parsedOptions };
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
    const { options, parsedOptions, packageInfos } = getOptionsAndPackages({ fetch: false });

    generateChangeFiles(['foo'], options);
    repo.push();

    let fetchCount = 0;
    addGitObserver(args => {
      args[0] === 'fetch' && fetchCount++;
    });

    // For this test, run validate first to simulate what the CLI does.
    // This would catch double bump issues if the validate step's bump call mutated the original PackageInfos.
    validate(options, { checkDependencies: true }, packageInfos);

    await publish(options, packageInfos);

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
    const newPackageInfos = getPackageInfos(parsedOptions);
    expect(newPackageInfos.foo.version).toBe('1.1.0');
  });

  it('can perform a successful npm publish in detached HEAD', async () => {
    repositoryFactory = new RepositoryFactory('single');
    repo = repositoryFactory.cloneRepository();

    const { options, packageInfos } = getOptionsAndPackages({
      push: false,
    });

    generateChangeFiles(['foo'], options);
    repo.push();

    repo.checkout('--detach');

    await publish(options, packageInfos);

    expect(npmMock.getPublishedVersions('foo')).toEqual({
      versions: ['1.1.0'],
      'dist-tags': { latest: '1.1.0' },
    });
  });

  it('can perform a successful npm publish from a race condition', async () => {
    repositoryFactory = new RepositoryFactory('single');
    repo = repositoryFactory.cloneRepository();

    const { options, packageInfos } = getOptionsAndPackages();

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

    await publish(options, packageInfos);

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
    // const newPackageInfos = getPackageInfos(parsedOptions);
    // expect(newPackageInfos.foo.version).toBe('1.1.0');
  });

  it('can perform a successful npm publish from a race condition in the dependencies', async () => {
    repositoryFactory = new RepositoryFactory('single');
    repo = repositoryFactory.cloneRepository();

    const { options, parsedOptions, packageInfos } = getOptionsAndPackages();

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

    await publish(options, packageInfos);

    expect(npmMock.getPublishedVersions('foo')).toEqual({
      versions: ['1.1.0'],
      'dist-tags': { latest: '1.1.0' },
    });

    repo.checkout(defaultBranchName);
    repo.pull();
    expect(repo.getCurrentTags()).toEqual(['foo_v1.1.0']);

    // this indicates 2 tries
    expect(fetchCount).toBe(2);

    const newPackageInfos = getPackageInfos(parsedOptions);
    expect(newPackageInfos.foo.version).toBe('1.1.0');
    expect(newPackageInfos.foo.dependencies?.baz).toBeUndefined();
  });

  it('can perform a successful npm publish without bump', async () => {
    repositoryFactory = new RepositoryFactory('single');
    repo = repositoryFactory.cloneRepository();

    const { options, parsedOptions, packageInfos } = getOptionsAndPackages({ bump: false, fetch: false });

    generateChangeFiles(['foo'], options);
    repo.push();

    await publish(options, packageInfos);

    expect(npmMock.getPublishedVersions('foo')).toEqual({
      versions: ['1.0.0'],
      'dist-tags': { latest: '1.0.0' },
    });

    repo.checkout(defaultBranchName);
    repo.pull();
    expect(repo.getCurrentTags()).toEqual([]);

    const newPackageInfos = getPackageInfos(parsedOptions);
    expect(newPackageInfos.foo.version).toBe('1.0.0');
  });

  it('publishes only changed packages in a monorepo', async () => {
    repositoryFactory = new RepositoryFactory('monorepo');
    repo = repositoryFactory.cloneRepository();

    const { options, parsedOptions, packageInfos } = getOptionsAndPackages({ fetch: false });

    generateChangeFiles(['foo'], options);
    repo.push();

    // For this test, run validate first to simulate what the CLI does
    validate(options, { checkDependencies: true }, packageInfos);

    await publish(options, packageInfos);

    expect(npmMock.getPublishedVersions('bar')).toBeUndefined();

    expect(npmMock.getPublishedVersions('foo')).toEqual({
      versions: ['1.1.0'],
      'dist-tags': { latest: '1.1.0' },
    });

    repo.checkout(defaultBranchName);
    repo.pull();
    expect(repo.getCurrentTags()).toEqual(['foo_v1.1.0']);

    const newPackageInfos = getPackageInfos(parsedOptions);
    expect(newPackageInfos.foo.version).toBe('1.1.0');
  });

  it('publishes dependent packages in a monorepo', async () => {
    repositoryFactory = new RepositoryFactory('monorepo');
    repo = repositoryFactory.cloneRepository();

    const { options, parsedOptions, packageInfos } = getOptionsAndPackages({ fetch: false });

    // bump baz => dependent bump bar => dependent bump foo
    generateChangeFiles(['baz'], options);
    expect(repositoryFactory.fixture.folders.packages.foo.dependencies!.bar).toBeTruthy();
    expect(repositoryFactory.fixture.folders.packages.bar.dependencies!.baz).toBeTruthy();
    repo.push();

    // For this test, run validate first to simulate what the CLI does
    validate(options, { checkDependencies: true }, packageInfos);

    await publish(options, packageInfos);

    expect(npmMock.getPublishedVersions('baz')).toEqual({ versions: ['1.4.0'], 'dist-tags': { latest: '1.4.0' } });

    expect(npmMock.getPublishedVersions('bar')).toEqual({ versions: ['1.3.5'], 'dist-tags': { latest: '1.3.5' } });
    expect(npmMock.getPublishedPackage('bar')).toMatchObject({ version: '1.3.5', dependencies: { baz: '^1.4.0' } });

    expect(npmMock.getPublishedVersions('foo')).toEqual({ versions: ['1.0.1'], 'dist-tags': { latest: '1.0.1' } });
    expect(npmMock.getPublishedPackage('foo')).toMatchObject({ version: '1.0.1', dependencies: { bar: '^1.3.5' } });

    repo.checkout(defaultBranchName);
    repo.pull();
    expect(repo.getCurrentTags()).toEqual(['bar_v1.3.5', 'baz_v1.4.0', 'foo_v1.0.1']);

    const newPackageInfos = getPackageInfos(parsedOptions);
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

    const { options, packageInfos } = getOptionsAndPackages({ new: true, fetch: false });

    generateChangeFiles(['foo'], options);
    repo.push();

    await publish(options, packageInfos);

    expect(npmMock.getPublishedVersions('foo')).toEqual({ versions: ['1.1.0'], 'dist-tags': { latest: '1.1.0' } });
    expect(npmMock.getPublishedVersions('bar')).toEqual({ versions: ['1.3.4'], 'dist-tags': { latest: '1.3.4' } });

    repo.checkout(defaultBranchName);
    repo.pull();
    expect(repo.getCurrentTags()).toEqual(['bar_v1.3.4', 'foo_v1.1.0']);
  });

  it('does not publish an out-of-scope package', async () => {
    repositoryFactory = new RepositoryFactory('monorepo');
    repo = repositoryFactory.cloneRepository();

    const { options, parsedOptions, packageInfos } = getOptionsAndPackages({
      scope: ['!packages/foo'],
      fetch: false,
    });

    generateChangeFiles(['foo', 'bar'], options);
    expect(getChangeFiles(options)).toHaveLength(2);
    repo.push();

    await publish(options, packageInfos);

    expect(npmMock.getPublishedVersions('foo')).toBeUndefined();
    expect(npmMock.getPublishedVersions('bar')).toEqual({
      versions: ['1.4.0'],
      'dist-tags': { latest: '1.4.0' },
    });

    repo.checkout(defaultBranchName);
    repo.pull();
    expect(repo.getCurrentTags()).toEqual(['bar_v1.4.0']);

    const newPackageInfos = getPackageInfos(parsedOptions);
    expect(newPackageInfos.bar.version).toBe('1.4.0');
    expect(newPackageInfos.foo.version).toBe('1.0.0');
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

    const { options, packageInfos } = getOptionsAndPackages({
      fetch: false,
      hooks: {
        prepublish: (packagePath: string) => {
          const packageJsonPath = path.join(packagePath, 'package.json');
          const packageJson = readJson<ExtraPackageJson>(packageJsonPath);
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

    await publish(options, packageInfos);

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

  it('specifies fetch depth when depth param is defined', async () => {
    repositoryFactory = new RepositoryFactory('single');
    repo = repositoryFactory.cloneRepository();

    const { options, packageInfos } = getOptionsAndPackages({
      depth: 10,
    });

    generateChangeFiles(['foo'], options);
    repo.push();

    let fetchCommand = '';

    addGitObserver(args => {
      if (args[0] === 'fetch') {
        fetchCommand = args.join(' ');
      }
    });

    await publish(options, packageInfos);

    expect(npmMock.getPublishedVersions('foo')).toEqual({
      versions: ['1.1.0'],
      'dist-tags': { latest: '1.1.0' },
    });

    expect(fetchCommand).toMatch('--depth=10');
  });

  it('calls precommit hook before committing changes', async () => {
    repositoryFactory = new RepositoryFactory('monorepo');
    repo = repositoryFactory.cloneRepository();

    const { options, packageInfos } = getOptionsAndPackages({
      publish: false, // irrelevant to this test
      fetch: false,
      hooks: {
        precommit: jest.fn(async (cwd: string) => {
          expect(readJson<PackageJson>(path.join(cwd, 'packages/foo/package.json')).version).toBe('1.1.0');
          const filePath = path.join(cwd, 'foo.txt');
          await fsPromises.writeFile(filePath, 'foo');
        }),
      },
    });

    generateChangeFiles(['foo', 'bar'], options);
    repo.push();

    await publish(options, packageInfos);

    // precommit was called (once for whole repo, not per package)
    expect(options.hooks?.precommit).toHaveBeenCalledTimes(1);
    // but changes from publish process were reverted locally
    const txtPath = repo.pathTo('foo.txt');
    expect(fs.existsSync(txtPath)).toBe(false);

    repo.checkout(defaultBranchName);
    repo.pull();

    // changes from publish process were committed
    expect(fs.existsSync(txtPath)).toBe(true);
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
    const { options, packageInfos } = getOptionsAndPackages({ concurrency, fetch: false, push: false });
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

    await publish(options, packageInfos);
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

    const { options, packageInfos } = getOptionsAndPackages({
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

    await expect(publish(options, packageInfos)).rejects.toThrow(
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
    const { options, packageInfos } = getOptionsAndPackages({
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

    await publish(options, packageInfos);
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
