import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { initMockLogs, readJson } from '@microsoft/beachball-test-utilities';
import fs from 'node:fs';
import { addGitObserver, catalogsToYaml, clearGitObservers, getPackageInfo, type Catalogs } from 'workspace-tools';
import { generateChangeFiles, getChangeFiles } from '../__fixtures__/changeFiles';
import { defaultBranchName, defaultRemoteBranchName } from '../__fixtures__/gitDefaults';
import { _mockNpmPublish, initNpmMock } from '../__fixtures__/mockNpm';
import { deepFreezeProperties } from '../__fixtures__/object';
import type { Repository } from '../__fixtures__/repository';
import { RepositoryFactory, type RepoFixture } from '../__fixtures__/repositoryFactory';
import { publish } from '../commands/publish';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import { getOptions as _getOptions } from '../options/getOptions';
import type { ParsedOptions, RepoOptions } from '../types/BeachballOptions';
import type { PackageJson } from '../types/PackageInfo';
import { validate } from '../validation/validate';

// These tests are slow, so they should only cover E2E publishing scenarios that can't be fully
// covered by lower-level tests (such as publishToRegistry or bumping functional tests), and a
// few all-up scenarios as sanity checks. Git scenarios should go in bumpAndPush functional
// tests where possible, and npm scenarios should potentially go in publishNpm.test.ts instead.
//
// Spawning actual npm to run commands against a fake registry is extremely slow, so mock it for
// this test (packagePublish covers the more complete npm registry scenario).
//
// If an issue is found in the future that could only be caught by this test using real npm,
// a new test file with a real registry should be created to cover that specific scenario.
jest.mock('../packageManager/npm');

describe('publish command (e2e)', () => {
  const npmMock = initNpmMock();

  let repositoryFactory: RepositoryFactory | undefined;
  let repo: Repository | undefined;

  // show error logs for these tests
  initMockLogs({ alsoLog: ['error'] });

  async function getOptions(repoOptions?: Partial<RepoOptions>, extraArgv?: string[]) {
    const parsedOptions = await _getOptions({
      cwd: repo!.rootPath,
      argv: ['node', 'beachball', 'publish', '--yes', ...(extraArgv || [])],
      env: {},
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

  // This test documents a mix of reasonable and odd behavior with option combinations
  // (will be fixed in a future change)
  it.each([['publish'], ['publish --no-push'], ['publish --no-publish']])(
    'handles single-package publishing with %s',
    async command => {
      const argv = command.split(' ').slice(1);
      const publishes = !argv.includes('--no-publish');
      const pushes = !argv.includes('--no-push');

      repositoryFactory = new RepositoryFactory('single');
      repo = repositoryFactory.cloneRepository();

      const { options, parsedOptions } = await getOptions(undefined, argv);

      generateChangeFiles(['foo'], options);
      repo.push();

      const originalHash = repo.getCurrentHash();
      const originalPackage = readJson<PackageJson>(repo.pathTo('package.json'));
      expect(repo.status()).toEqual([]);

      await publishWrapper(parsedOptions);

      // Package is published to npm if --publish (default)
      if (publishes) {
        expect(npmMock.getPublishedVersions('foo')).toEqual({ versions: ['1.1.0'], 'dist-tags': { latest: '1.1.0' } });
      } else {
        expect(npmMock.getPublishedVersions('foo')).toBeUndefined();
      }

      // Check before pulling: cleanup restores the original branch, but does not advance its HEAD.
      expect(repo.getCurrentBranch()).toBe(defaultBranchName);
      expect(repo.getBranches()).toEqual([defaultBranchName]);
      // No tags added pointing to original commit
      expect(repo.getCurrentTags()).toEqual([]);
      // COMMITTED state hasn't changed (there may be uncommitted changes, below)
      expect(repo.getCurrentHash()).toBe(originalHash);
      expect(JSON.parse(repo.git(['show', 'HEAD:package.json']).stdout)).toEqual(originalPackage);

      // Get the actual remote refs after publishing
      const remoteRefs = repo.getRemoteRefs();
      const remoteHash = remoteRefs.branches?.[defaultBranchName] ?? '';

      if (pushes) {
        // --push (default): the bump is committed and pushed, AND local state is reverted
        // (same hash + empty status => local state has been reverted)
        expect(repo.status()).toEqual([]);
        // tag exists locally
        expect(repo.getTags()).toEqual(['foo_v1.1.0']);
        // remote branch and tags are updated
        expect(remoteRefs).toEqual({
          branches: { [defaultBranchName]: expect.not.stringContaining(originalHash) },
          tags: { 'foo_v1.1.0': expect.anything() },
        });
        // local ref of remote is already updated
        expect(repo.git(['rev-parse', defaultRemoteBranchName]).stdout.trim()).toEqual(remoteHash);

        // Only if --push: pull and check the updated contents
        repo.pull();
        expect(repo.getCurrentHash()).toBe(remoteHash);
        expect(readJson<PackageJson>(repo.pathTo('package.json')).version).toBe('1.1.0');
        expect(getChangeFiles(options)).toEqual([]);
        expect(fs.readFileSync(repo.pathTo('CHANGELOG.md'), 'utf8')).toContain('1.1.0');
        expect(repo.getCurrentTags()).toEqual(['foo_v1.1.0']);
      } else {
        // --no-push: the bump is not committed and is left in the local tree
        // (this is the main case where behavior should be reconsidered)
        expect(readJson<PackageJson>(repo.pathTo('package.json')).version).toEqual('1.1.0');
        expect(repo.status()).toEqual([expect.stringContaining(' D change/'), ' M package.json', '?? CHANGELOG.md']);
        // no tags created
        expect(repo.getTags()).toEqual([]);
        // remote branch not updated, no tags created
        expect(remoteRefs).toEqual({ branches: { [defaultBranchName]: originalHash } });
        // because there were no remote updates, it's not necessary to pull and re-check
      }
    }
  );

  it('can perform a successful npm publish in detached HEAD', async () => {
    repositoryFactory = new RepositoryFactory('single');
    repo = repositoryFactory.cloneRepository();

    const { options, parsedOptions } = await getOptions({
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

    const { options, parsedOptions } = await getOptions();

    generateChangeFiles(['foo'], options);
    repo.push();

    // Adds a step that injects a race condition
    let fetchCount = 0;

    addGitObserver(args => {
      if (args[0] === 'fetch') {
        if (fetchCount === 0) {
          const anotherRepo = repositoryFactory!.cloneRepository();
          // inject a checkin
          anotherRepo.updateJsonFile('package.json', { version: '1.0.2' }, { commit: true });
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

    const { options, parsedOptions } = await getOptions();

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

    const { options, parsedOptions } = await getOptions({ bump: false, fetch: false });

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

    const { options, parsedOptions } = await getOptions({ fetch: false });

    // bump baz => dependent bump bar => dependent bump foo
    generateChangeFiles(['baz'], options);
    expect(repositoryFactory.fixture.folders.packages.foo.dependencies!.bar).toBeTruthy();
    expect(repositoryFactory.fixture.folders.packages.bar.dependencies!.baz).toBeTruthy();
    repo.push();

    addGitObserver(args => {
      // no fetch when flag set to false
      expect(args[0]).not.toBe('fetch');
    });

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

  // A package with shouldPublish: false gets all steps of the publish process except npm publish
  it('handles packages with shouldPublish:false', async () => {
    repositoryFactory = new RepositoryFactory({
      folders: {
        packages: {
          foo: { version: '1.0.0', beachball: { shouldPublish: false } },
          bar: { version: '1.0.0' },
          baz: { version: '1.0.0', dependencies: { bar: '^1.0.0' } },
        },
      },
    });
    repo = repositoryFactory.cloneRepository();

    const { options, parsedOptions } = await getOptions({ fetch: false });

    generateChangeFiles(['foo', 'bar'], options);
    repo.push();

    await publishWrapper(parsedOptions);

    // foo is not published, but the other two are
    expect(npmMock.getPublishedVersions('foo')).toBeUndefined();
    expect(npmMock.getPublishedVersions('bar')).toEqual({ versions: ['1.1.0'], 'dist-tags': { latest: '1.1.0' } });
    expect(npmMock.getPublishedVersions('baz')).toEqual({ versions: ['1.0.1'], 'dist-tags': { latest: '1.0.1' } });

    repo.checkout(defaultBranchName);
    repo.pull();
    // foo is git tagged
    expect(repo.getCurrentTags()).toEqual(['bar_v1.1.0', 'baz_v1.0.1', 'foo_v1.1.0']);

    const newPackageInfos = getPackageInfos(parsedOptions);
    // foo is bumped and committed with a changelog
    expect(newPackageInfos.foo.version).toBe('1.1.0');
    expect(fs.existsSync(repo.pathTo('packages/foo/CHANGELOG.md'))).toBe(true);
  });

  it('does not publish an out-of-scope package', async () => {
    repositoryFactory = new RepositoryFactory('monorepo');
    repo = repositoryFactory.cloneRepository();

    const { options, parsedOptions } = await getOptions({
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

    const { options, parsedOptions } = await getOptions({ bumpDeps: true, fetch: false });
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

    const extra = {
      customOnPublish: { main: 'lib/index.js' },
      customAfterPublish: { notify: 'message' },
    };
    type ExtraPackageJson = PackageJson & Partial<typeof extra>;
    repo.updateJsonFile('packages/foo/package.json', extra, { commit: true });

    let notified: string | undefined;

    const { options, parsedOptions } = await getOptions({
      fetch: false,
      hooks: {
        prepublish: (packagePath, name, version) => {
          const { packageJsonPath, ...packageJson } = getPackageInfo(packagePath)!;
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
          const packageInfo = getPackageInfo(packagePath) as ExtraPackageJson;
          if (packageInfo.customAfterPublish) {
            notified = packageInfo.customAfterPublish.notify;
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
    const fooJsonPost = getPackageInfo(repo.pathTo('packages/foo')) as ExtraPackageJson;
    expect(fooJsonPost.main).toBe('src/index.ts');
    expect(fooJsonPost.customOnPublish?.main).toBe('lib/index.js');
    expect(notified).toBe(fooJsonPost.customAfterPublish?.notify);
  });
});
