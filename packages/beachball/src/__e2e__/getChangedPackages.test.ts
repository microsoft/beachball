import { describe, expect, it, afterEach, beforeAll, afterAll, jest } from '@jest/globals';
import { defaultBranchName, defaultRemoteBranchName } from '../__fixtures__/gitDefaults';
import { RepositoryFactory } from '../__fixtures__/repositoryFactory';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import type { RepoOptions } from '../types/BeachballOptions';
import { getChangedPackages } from '../changefile/getChangedPackages';
import { initMockLogs } from '../__fixtures__/mockLogs';
import { generateChangeFiles } from '../__fixtures__/changeFiles';
import type { Repository } from '../__fixtures__/repository';
import { getParsedOptions } from '../options/getOptions';
import { getScopedPackages } from '../monorepo/getScopedPackages';
import { addGitObserver, clearGitObservers, getPackageInfo as getWsPackageInfo } from 'workspace-tools';

//
// NOTE: These tests should mostly cover logic specific to getChangePackages itself.
// Details of detecting/ignoring file and package changes are covered by getAllChangedPackages tests.
//
describe('getChangedPackages', () => {
  const gitObserver = jest.fn();
  const logs = initMockLogs();

  /** Factory reused for most tests */
  let monorepoFactory: RepositoryFactory;
  const extraFactories: RepositoryFactory[] = [];
  /** Monorepo reused for multiple tests where it's safe */
  let _reusedRepo: Repository;
  /** Repo for current test */
  let repo: Repository | undefined;

  /**
   * Get the reused repo for this test and create a new branch. DO NOT:
   * - push changes
   * - create uncommitted files or directories (commited files are fine because they'll go away
   *   on branch change)
   */
  function getReusedRepoWithBranch() {
    repo = _reusedRepo;
    repo.checkoutTestBranch();
    return repo;
  }

  function getOptions(params: { repoOptions?: Partial<RepoOptions>; extraArgv?: string[]; cwd?: string } = {}) {
    const { repoOptions, extraArgv = [], cwd = repo!.rootPath } = params;
    return getParsedOptions({
      cwd,
      argv: ['node', 'beachball', 'change', ...extraArgv],
      env: {},
      testRepoOptions: {
        branch: defaultRemoteBranchName,
        fetch: false,
        ...repoOptions,
      },
    });
  }

  /** Get options/context, clear `gitObserver` mock, and call `getChangedPackages` */
  function getChangedPackagesWrapper(params: { repoOptions?: Partial<RepoOptions>; extraArgv?: string[] } = {}) {
    const parsedOptions = getOptions(params);
    const packageInfos = getPackageInfos(parsedOptions);
    const scopedPackages = getScopedPackages(parsedOptions.options, packageInfos);
    gitObserver.mockClear();
    return getChangedPackages(parsedOptions.options, packageInfos, scopedPackages);
  }

  beforeAll(() => {
    monorepoFactory = new RepositoryFactory('monorepo');
    _reusedRepo = monorepoFactory.cloneRepository();
    addGitObserver(gitObserver);
  });

  afterEach(() => {
    gitObserver.mockClear();
    repo = undefined;
  });

  afterAll(() => {
    // clean up the factory and all clones
    monorepoFactory.cleanUp();
    extraFactories.forEach(factory => factory.cleanUp());
    clearGitObservers();
  });

  it('returns the given package name(s) as-is', () => {
    repo = getReusedRepoWithBranch();
    expect(getChangedPackagesWrapper({ extraArgv: ['--package', 'foo'] })).toEqual(['foo']);
    expect(gitObserver).not.toHaveBeenCalled();

    // Currently it doesn't even check validity
    const result = getChangedPackagesWrapper({
      extraArgv: ['--package', 'foo', '--package', 'bar', '--package', 'nope'],
    });
    expect(result).toEqual(['foo', 'bar', 'nope']);
    expect(gitObserver).not.toHaveBeenCalled();
  });

  // Basic test as a sanity check, but simple file-based cases are mainly covered by getAllChangedPackages
  it('detects changed files in monorepo', () => {
    repo = getReusedRepoWithBranch();

    // empty if no changes yet
    expect(getChangedPackagesWrapper()).toEqual([]);

    repo.commitChange('packages/foo/test.js');
    expect(getChangedPackagesWrapper()).toEqual(['foo']);

    expect(logs.getMockLines('all', { sanitize: true })).toMatchInlineSnapshot(`
      "[log] Checking for changes against "origin/master"
      [log] Checking for changes against "origin/master""
    `);
  });

  it('excludes packages that already have change files', () => {
    repo = getReusedRepoWithBranch();

    // setup: change foo, create a change file, commit
    repo.checkout('-b', 'test');
    repo.commitChange('packages/foo/test.js');
    generateChangeFiles(['foo'], { ...getOptions().options, commit: true });
    logs.clear();

    // foo is not included in changed packages
    let changedPackages = getChangedPackagesWrapper({ extraArgv: ['--verbose'] });
    const logLines = logs.getMockLines('all', { sanitize: true });
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
    expect(changedPackages).toEqual([]);
    logs.clear();

    // change bar => bar is the only changed package returned
    // (with the reused repo, it must commit the change)
    repo.commitChange('packages/bar/test.js');
    changedPackages = getChangedPackagesWrapper({ extraArgv: ['--verbose'] });
    expect(logs.getMockLines('all', { sanitize: true })).toMatchInlineSnapshot(`
      "[log] Checking for changes against "origin/master"
      [log] Found 3 changed files in current branch (before filtering)
      [log]   - ~~change/foo-<guid>.json~~ (ignored by pattern "change/*.json")
      [log]   - packages/bar/test.js
      [log]   - packages/foo/test.js
      [log] Found 2 files in 2 packages that should be published
      [log] Your local repository already has change files for these packages:
        • foo"
    `);
    expect(changedPackages).toEqual(['bar']);
  });

  it('returns all packages with all: true, removing those with change files', () => {
    repo = getReusedRepoWithBranch();
    generateChangeFiles(['foo', 'a'], { ...getOptions().options, commit: true });

    const result = getChangedPackagesWrapper({ extraArgv: ['--all'] });
    expect(result.sort()).toEqual(['b', 'bar', 'baz']);
    expect(gitObserver).toHaveBeenCalled();
  });

  it('throws if the remote is invalid', () => {
    repo = getReusedRepoWithBranch();
    const customRemote = 'foo';
    repo.git(['remote', 'add', customRemote, 'file:///__nonexistent']);
    repo.commitChange('fake.js');

    expect(() => {
      getChangedPackagesWrapper({ repoOptions: { fetch: true, branch: `${customRemote}/${defaultBranchName}` } });
    }).toThrow(`Fetching branch "${defaultBranchName}" from remote "${customRemote}" failed`);
    expect(gitObserver).toHaveBeenCalled();
  });

  it('excludes packages with staged (not committed) change files', () => {
    // this can't use the reused repo because it needs to stage changes
    repo = monorepoFactory.cloneRepository();

    // setup: create branch, change foo
    repo.checkout('-b', 'test-staged');
    repo.commitChange('packages/foo/test.js');
    // generate change files but only stage them (don't commit)
    generateChangeFiles(['foo'], { ...getOptions().options, commit: false });
    logs.clear();

    // foo is not included in changed packages because its staged change file is found
    const changedPackages = getChangedPackagesWrapper({ extraArgv: ['--verbose'] });
    expect(logs.getMockLines('all')).toMatch(
      /Your local repository already has change files for these packages:\s+• foo/
    );
    expect(changedPackages).toEqual([]);
  });

  it('ignores change files that exist in target remote branch', () => {
    // This needs a separate factory since it pushes changes
    const repositoryFactory = new RepositoryFactory('single');
    extraFactories.push(repositoryFactory);
    repo = repositoryFactory.cloneRepository();

    // create and push a change file in master
    const packageName = getWsPackageInfo(repo.rootPath)!.name;
    generateChangeFiles([packageName], { ...getOptions().options, commit: true });
    repo.push();

    // create a new branch and stage changes to an existing file
    repo.checkout('-b', 'test');
    repo.stageChange('yarn.lock', 'hi'); // this should already exist
    logs.clear();

    const changedPackages = getChangedPackagesWrapper({ extraArgv: ['--verbose'] });
    expect(changedPackages).toEqual(['foo']);
    expect(logs.getMockLines('all', { sanitize: true })).toMatchInlineSnapshot(`
      "[log] Checking for changes against "origin/master"
      [log] Found 1 changed file in current branch (before filtering)
      [log]   - yarn.lock
      [log] Found 1 file in 1 package that should be published"
    `);
  });
});
