import { describe, expect, it, afterEach, beforeAll, afterAll, jest } from '@jest/globals';
import { defaultBranchName, defaultRemoteBranchName } from '../__fixtures__/gitDefaults';
import { RepositoryFactory } from '../__fixtures__/repositoryFactory';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import type { BeachballOptions, RepoOptions } from '../types/BeachballOptions';
import { getChangedPackages } from '../changefile/getChangedPackages';
import { initMockLogs } from '../__fixtures__/mockLogs';
import { generateChangeFiles } from '../__fixtures__/changeFiles';
import type { Repository } from '../__fixtures__/repository';
import { getParsedOptions } from '../options/getOptions';
import { getScopedPackages } from '../monorepo/getScopedPackages';
import { addGitObserver, clearGitObservers } from 'workspace-tools';

// These were formerly the isChangeFileNeeded tests.
// They still cover some relevant cases and have a simpler/cheaper setup.
describe('getChangedPackages (basic)', () => {
  /** Factory reused for all the tests */
  let repositoryFactory: RepositoryFactory;
  /**
   * Clone from the factory reused for multiple tests where it's safe.
   * DO NOT:
   * - push changes
   * - create uncommitted files or directories
   */
  let reusedRepo: Repository;
  const gitObserver = jest.fn();
  initMockLogs();

  /** Get options/context, clear `gitObserver` mock, and call `getChangedPackages` */
  function getChangedPackagesWrapper(options?: Partial<BeachballOptions>) {
    const parsedOptions = getParsedOptions({
      cwd: reusedRepo.rootPath,
      argv: [],
      testRepoOptions: {
        fetch: false,
        branch: defaultRemoteBranchName,
        ...options,
      },
    });
    const packageInfos = getPackageInfos(parsedOptions);
    const scopedPackages = getScopedPackages(parsedOptions.options, packageInfos);
    gitObserver.mockClear();
    return getChangedPackages(parsedOptions.options, packageInfos, scopedPackages);
  }

  /** In `reusedRepo`, check out a branch with a unique name based on master */
  function checkOutTestBranch() {
    const branchName = expect.getState().currentTestName!.replace(/\W+/g, '-');
    reusedRepo.checkout('-b', branchName, defaultBranchName);
  }

  beforeAll(() => {
    repositoryFactory = new RepositoryFactory('monorepo');
    reusedRepo = repositoryFactory.cloneRepository();
    addGitObserver(gitObserver);
  });

  afterEach(() => {
    gitObserver.mockClear();
  });

  afterAll(() => {
    // clean up the factory and all clones
    repositoryFactory.cleanUp();
    clearGitObservers();
  });

  it('returns empty list when no changes have been made', () => {
    expect(getChangedPackagesWrapper()).toEqual([]);
    expect(gitObserver).toHaveBeenCalled();
  });

  it('returns package name when changes exist in a new branch', () => {
    checkOutTestBranch();
    reusedRepo.commitChange('packages/foo/myFilename');
    expect(getChangedPackagesWrapper()).toEqual(['foo']);
    expect(gitObserver).toHaveBeenCalled();
  });

  it('returns empty list when changes are CHANGELOG files', () => {
    checkOutTestBranch();
    reusedRepo.commitChange('packages/foo/CHANGELOG.md');
    expect(getChangedPackagesWrapper()).toEqual([]);
    expect(gitObserver).toHaveBeenCalled();
  });

  it('returns the given package name(s) as-is', () => {
    expect(getChangedPackagesWrapper({ package: 'foo' })).toEqual(['foo']);
    expect(gitObserver).not.toHaveBeenCalled();

    // Currently it doesn't even check validity
    expect(getChangedPackagesWrapper({ package: ['foo', 'bar', 'nope'] })).toEqual(['foo', 'bar', 'nope']);
    expect(gitObserver).not.toHaveBeenCalled();
  });

  it('returns all packages with all: true', () => {
    expect(getChangedPackagesWrapper({ all: true }).sort()).toEqual(['a', 'b', 'bar', 'baz', 'foo']);
    expect(gitObserver).not.toHaveBeenCalled();
  });

  it('throws if the remote is invalid', () => {
    const customRemote = 'foo';
    reusedRepo.git(['remote', 'add', customRemote, 'file:///__nonexistent']);
    checkOutTestBranch();
    reusedRepo.commitChange('fake.js');

    expect(() => {
      getChangedPackagesWrapper({ fetch: true, branch: `${customRemote}/${defaultBranchName}` });
    }).toThrow(`Fetching branch "${defaultBranchName}" from remote "${customRemote}" failed`);
    expect(gitObserver).toHaveBeenCalled();
  });
});

describe('getChangedPackages', () => {
  // These tests reuse factories since they don't push changes
  let singleFactory: RepositoryFactory;
  let monorepoFactory: RepositoryFactory;
  let multiFactory: RepositoryFactory;
  const extraFactories: RepositoryFactory[] = [];
  let repo: Repository | undefined;
  const logs = initMockLogs();

  function getOptionsAndPackages(
    params: { repoOptions?: Partial<RepoOptions>; extraArgv?: string[]; cwd?: string } = {}
  ) {
    const { repoOptions, extraArgv = [], cwd = repo!.rootPath } = params;
    const parsedOptions = getParsedOptions({
      cwd,
      argv: ['node', 'beachball', 'change', ...extraArgv],
      testRepoOptions: {
        branch: defaultRemoteBranchName,
        fetch: false,
        ...repoOptions,
      },
    });
    const packageInfos = getPackageInfos(parsedOptions);
    const scopedPackages = getScopedPackages(parsedOptions.options, packageInfos);
    return { packageInfos, options: parsedOptions.options, parsedOptions, scopedPackages };
  }

  beforeAll(() => {
    singleFactory = new RepositoryFactory('single');
    monorepoFactory = new RepositoryFactory('monorepo');
    multiFactory = new RepositoryFactory('multi-workspace');
  });

  afterEach(() => {
    repo = undefined;
  });

  afterAll(() => {
    singleFactory.cleanUp();
    monorepoFactory.cleanUp();
    multiFactory.cleanUp();
    extraFactories.forEach(factory => factory.cleanUp());
  });

  it('detects changed files in single-package repo', () => {
    repo = singleFactory.cloneRepository();
    const { packageInfos, scopedPackages, options } = getOptionsAndPackages();

    expect(getChangedPackages(options, packageInfos, scopedPackages)).toStrictEqual([]);

    repo.stageChange('foo.js');
    expect(getChangedPackages(options, packageInfos, scopedPackages)).toStrictEqual(['foo']);
  });

  it('respects ignorePatterns option', () => {
    repo = singleFactory.cloneRepository();

    const { packageInfos, scopedPackages, options } = getOptionsAndPackages({
      repoOptions: { ignorePatterns: ['*.test.js', 'tests/**', 'yarn.lock'] },
      extraArgv: ['--verbose'],
    });

    repo.writeFile('src/foo.test.js');
    repo.writeFile('src/foo.test.js');
    repo.writeFile('tests/stuff.js');
    repo.writeFile('yarn.lock');
    repo.git(['add', '-A']); // stage in one git operation

    expect(getChangedPackages(options, packageInfos, scopedPackages)).toStrictEqual([]);
    const logLines = logs.getMockLines('all');
    expect(logLines).toMatch('ignored by pattern');
    expect(logLines).toMatchInlineSnapshot(`
      "[log] Checking for changes against "origin/master"
      [log] Found 2 changed files in current branch (before filtering)
      [log]   - ~~src/foo.test.js~~ (ignored by pattern "*.test.js")
      [log]   - ~~tests/stuff.js~~ (ignored by pattern "tests/**")
      [log] All files were ignored"
    `);
  });

  it('detects changed files in monorepo', () => {
    repo = monorepoFactory.cloneRepository();

    const { packageInfos, scopedPackages, options } = getOptionsAndPackages();

    expect(getChangedPackages(options, packageInfos, scopedPackages)).toStrictEqual([]);

    repo.stageChange('packages/foo/test.js');
    expect(getChangedPackages(options, packageInfos, scopedPackages)).toStrictEqual(['foo']);
  });

  it('excludes packages that already have change files', () => {
    repo = monorepoFactory.cloneRepository();

    const { packageInfos, scopedPackages, options } = getOptionsAndPackages({ extraArgv: ['--verbose'] });

    // setup: create branch, change foo, create a change file, commit
    repo.checkout('-b', 'test');
    repo.commitChange('packages/foo/test.js');
    generateChangeFiles(['foo'], options);
    logs.clear();

    // foo is not included in changed packages
    let changedPackages = getChangedPackages(options, packageInfos, scopedPackages);
    const logLines = logs.getMockLines('all', { guids: true });
    expect(logLines).toMatch(/Your local repository already has change files for these packages:\s+• foo/);
    expect(logLines).toMatchInlineSnapshot(`
      "[log] Checking for changes against "origin/master"
      [log] Found 2 changed files in current branch (before filtering)
      [log]   - ~~change/foo-<guid>.json~~ (ignored by pattern "change/*.json")
      [log]   - packages/foo/test.js
      [log] Found 1 file in 1 package that should be published
      [log] Your local repository already has change files for these packages:
        • foo"
    `);
    expect(changedPackages).toStrictEqual([]);
    logs.clear();

    // change bar => bar is the only changed package returned
    repo.stageChange('packages/bar/test.js');
    changedPackages = getChangedPackages(options, packageInfos, scopedPackages);
    expect(logs.getMockLines('all', { guids: true })).toMatchInlineSnapshot(`
      "[log] Checking for changes against "origin/master"
      [log] Found 3 changed files in current branch (before filtering)
      [log]   - ~~change/foo-<guid>.json~~ (ignored by pattern "change/*.json")
      [log]   - packages/foo/test.js
      [log]   - packages/bar/test.js
      [log] Found 2 files in 2 packages that should be published
      [log] Your local repository already has change files for these packages:
        • foo"
    `);
    expect(changedPackages).toStrictEqual(['bar']);
  });

  it('ignores change files that exist in target remote branch', () => {
    // This needs a separate factory since it pushes changes
    const repositoryFactory = new RepositoryFactory('single');
    extraFactories.push(repositoryFactory);
    repo = repositoryFactory.cloneRepository();
    const { packageInfos, scopedPackages, options } = getOptionsAndPackages({ extraArgv: ['--verbose'] });
    expect(options.commit).toBe(true);

    // create and push a change file in master
    generateChangeFiles(['foo'], options);
    repo.push();

    // create a new branch and stage a new file + changes to existing file
    repo.checkout('-b', 'test');
    repo.writeFile('test.js');
    repo.writeFile('yarn.lock', 'hi'); // this should already exist
    repo.git(['add', '-A']);
    logs.clear();

    const changedPackages = getChangedPackages(options, packageInfos, scopedPackages);
    expect(changedPackages).toStrictEqual(['foo']);
    expect(logs.getMockLines('all', { guids: true })).toMatchInlineSnapshot(`
      "[log] Checking for changes against "origin/master"
      [log] Found 2 changed files in current branch (before filtering)
      [log]   - test.js
      [log]   - yarn.lock
      [log] Found 2 files in 1 package that should be published"
    `);
  });

  it('ignores package changes as appropriate', () => {
    // Due to cost of fixtures, test various ignore scenarios together
    const customFactory = new RepositoryFactory({
      folders: {
        packages: {
          'private-pkg': { version: '1.0.0', private: true },
          'no-publish': { version: '1.0.0', beachball: { shouldPublish: false } as BeachballOptions },
          'out-of-scope': { version: '1.0.0' },
          'ignore-pkg': { version: '1.0.0' },
          'publish-me': { version: '1.0.0' },
        },
      },
    });
    extraFactories.push(customFactory);
    repo = customFactory.cloneRepository();
    repo.stageChange('packages/private-pkg/test.js');
    repo.stageChange('packages/no-publish/test.js');
    repo.stageChange('packages/out-of-scope/test.js');
    repo.stageChange('packages/ignore-pkg/jest.config.js');
    repo.stageChange('packages/ignore-pkg/CHANGELOG.md');
    repo.stageChange('packages/publish-me/test.js');

    const { packageInfos, scopedPackages, options } = getOptionsAndPackages({
      repoOptions: {
        scope: ['!packages/out-of-scope'],
        ignorePatterns: ['**/jest.config.js'],
      },
      extraArgv: ['--verbose'],
    });

    const changedPackages = getChangedPackages(options, packageInfos, scopedPackages);
    const logLines = logs.getMockLines('all');
    // check individual cases
    expect(logLines).toMatch('private-pkg is private');
    expect(logLines).toMatch('no-publish has beachball.shouldPublish=false');
    expect(logLines).toMatch('out-of-scope is out of scope');
    expect(logLines).toMatch('ignored by pattern "**/jest.config.js"');
    expect(logLines).toMatch('ignored by pattern "CHANGELOG.{md,json}"');
    // and overall output
    expect(logLines).toMatchInlineSnapshot(`
      "[log] Checking for changes against "origin/master"
      [log] Found 6 changed files in current branch (before filtering)
      [log]   - ~~packages/ignore-pkg/CHANGELOG.md~~ (ignored by pattern "CHANGELOG.{md,json}")
      [log]   - ~~packages/ignore-pkg/jest.config.js~~ (ignored by pattern "**/jest.config.js")
      [log]   - ~~packages/no-publish/test.js~~ (no-publish has beachball.shouldPublish=false)
      [log]   - ~~packages/out-of-scope/test.js~~ (out-of-scope is out of scope)
      [log]   - ~~packages/private-pkg/test.js~~ (private-pkg is private)
      [log]   - packages/publish-me/test.js
      [log] Found 1 file in 1 package that should be published"
    `);
    // and return value
    expect(changedPackages).toStrictEqual(['publish-me']);
  });

  it('detects changed files in multi-root monorepo repo', () => {
    repo = multiFactory.cloneRepository();
    const {
      options: rootOptions,
      packageInfos: rootPackageInfos,
      scopedPackages: rootScopedPackages,
    } = getOptionsAndPackages();
    expect(Object.keys(multiFactory.fixtures)).toEqual(['workspace-a', 'workspace-b']);

    const workspaceARoot = repo.pathTo('workspace-a');
    const workspaceBRoot = repo.pathTo('workspace-b');

    expect(getChangedPackages(rootOptions, rootPackageInfos, rootScopedPackages)).toStrictEqual([]);

    repo.stageChange('workspace-a/packages/foo/test.js');

    const infoA = getOptionsAndPackages({ cwd: workspaceARoot });
    const infoB = getOptionsAndPackages({ cwd: workspaceBRoot });
    const changedPackagesA = getChangedPackages(infoA.options, infoA.packageInfos, infoA.scopedPackages);
    const changedPackagesB = getChangedPackages(infoB.options, infoB.packageInfos, infoB.scopedPackages);
    const changedPackagesRoot = getChangedPackages(rootOptions, rootPackageInfos, rootScopedPackages);

    expect(changedPackagesA).toStrictEqual(['@workspace-a/foo']);
    expect(changedPackagesB).toStrictEqual([]);
    expect(changedPackagesRoot).toStrictEqual(['@workspace-a/foo']);
  });
});
