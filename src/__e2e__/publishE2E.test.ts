import { afterEach, describe, expect, it, jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { addGitObserver, catalogsToYaml, clearGitObservers, type Catalogs } from 'workspace-tools';
import { generateChangeFiles, getChangeFiles } from '../__fixtures__/changeFiles';
import { defaultBranchName, defaultRemoteBranchName } from '../__fixtures__/gitDefaults';
import { initMockLogs } from '../__fixtures__/mockLogs';
import { _mockNpmPublish, initNpmMock } from '../__fixtures__/mockNpm';
import { deepFreezeProperties } from '../__fixtures__/object';
import type { Repository } from '../__fixtures__/repository';
import { RepositoryFactory, type RepoFixture } from '../__fixtures__/repositoryFactory';
import { publish } from '../commands/publish';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import { readJson } from '../object/readJson';
import { getParsedOptions } from '../options/getOptions';
import type { ParsedOptions, RepoOptions } from '../types/BeachballOptions';
import type { PackageJson } from '../types/PackageInfo';
import { validate } from '../validation/validate';

// These tests are slow, so they should only cover E2E publishing scenarios that can't be fully
// covered by lower-level tests (such as publishToRegistry or bumping functional tests), and a
// few all-up scenarios as sanity checks. Tests specific to git or npm scenarios should
// potentially go in publishGit.test.ts or publishRegistry.test.ts instead.
//
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
  initMockLogs({ alsoLog: ['error'] });

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
    const newPackageInfos = getPackageInfos(parsedOptions);
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
    // const newPackageInfos = getPackageInfos(parsedOptions);
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

    const newPackageInfos = getPackageInfos(parsedOptions);
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

    const newPackageInfos = getPackageInfos(parsedOptions);
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

    const newPackageInfos = getPackageInfos(parsedOptions);
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
    const packageInfos = getPackageInfos(parsedOptions);
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

  // These tests are slow, so combine pre and post hooks.
  // This needs to be an E2E test to verify the versions etc passed through are correct.
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
});
