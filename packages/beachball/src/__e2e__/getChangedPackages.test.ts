import { describe, expect, it, afterEach, beforeAll, afterAll, jest } from '@jest/globals';
import {
  addGitObserver,
  clearGitObservers,
  getPackageInfo as getWsPackageInfo,
  type Catalogs,
  catalogsToYaml,
  getCatalogs,
} from 'workspace-tools';
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

//
// NOTE: These tests should mostly cover logic specific to getChangePackages itself.
// Details of detecting/ignoring file and package changes are covered by getAllChangedPackages tests.
//
describe('getChangedPackages', () => {
  const gitObserver = jest.fn();
  const logs = initMockLogs();

  let singleFactory: RepositoryFactory;
  let monorepoFactory: RepositoryFactory;
  const extraFactories: RepositoryFactory[] = [];
  /** Repos reused for some tests where it's safe (don't use directly) */
  let _reusedRepos: {
    single: Repository;
    monorepo: Repository;
  }; /** Repo for current test */
  let repo: Repository | undefined;

  /**
   * Get the reused repo for this test and create a new branch. DO NOT:
   * - push changes
   * - create uncommitted files or directories (commited files are fine because they'll go away
   *   on branch change)
   */
  function getReusedRepoWithBranch(type: 'single' | 'monorepo') {
    repo = type === 'single' ? _reusedRepos.single : _reusedRepos.monorepo;
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
  function getChangedPackagesWrapper(
    params: { repoOptions?: Partial<RepoOptions>; extraArgv?: string[]; cwd?: string } = {}
  ) {
    const parsedOptions = getOptions(params);
    const packageInfos = getPackageInfos(parsedOptions);
    const scopedPackages = getScopedPackages(parsedOptions.options, packageInfos);
    gitObserver.mockClear();
    return getChangedPackages(parsedOptions.options, packageInfos, scopedPackages);
  }

  beforeAll(() => {
    singleFactory = new RepositoryFactory('single');
    monorepoFactory = new RepositoryFactory('monorepo');
    _reusedRepos = {
      single: singleFactory.cloneRepository(),
      monorepo: monorepoFactory.cloneRepository(),
    };
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
    repo = getReusedRepoWithBranch('single');
    expect(getChangedPackagesWrapper({ extraArgv: ['--package', 'foo'] })).toEqual(['foo']);
    expect(gitObserver).not.toHaveBeenCalled();

    // Currently it doesn't even check validity
    const result = getChangedPackagesWrapper({
      extraArgv: ['--package', 'foo', '--package', 'bar', '--package', 'nope'],
    });
    expect(result).toEqual(['foo', 'bar', 'nope']);
    expect(gitObserver).not.toHaveBeenCalled();
  });

  // do a full test for each major repo structure
  it('detects changed files in single-package repo', () => {
    repo = getReusedRepoWithBranch('single');
    repo.commitChange('myFilename');
    expect(getChangedPackagesWrapper()).toEqual(['foo']);
    expect(gitObserver).toHaveBeenCalled();
  });

  it('detects changed files in monorepo', () => {
    repo = getReusedRepoWithBranch('monorepo');

    // empty if no changes yet
    expect(getChangedPackagesWrapper()).toEqual([]);

    repo.writeFile('packages/foo/test.js');
    repo.writeFile('packages/bar/test.js');
    repo.commitAll();

    logs.clear();
    const result = getChangedPackagesWrapper({ extraArgv: ['--verbose'] });
    expect(result.sort()).toEqual(['bar', 'foo']);
    expect(gitObserver).toHaveBeenCalled();

    expect(logs.getMockLines('all')).toMatchInlineSnapshot(`
        "[log] Checking for changes against "origin/master"
        [log] Found 2 changed files in current branch (before filtering)
        [log]   - packages/bar/test.js
        [log]   - packages/foo/test.js
        [log] Found 2 files in 2 packages that should be published"
      `);
  });

  it('detects changed files in multi-project monorepo', () => {
    // this is the only multi-project test
    const multiFactory = new RepositoryFactory('multi-project');
    extraFactories.push(multiFactory);
    repo = multiFactory.cloneRepository();
    expect(Object.keys(multiFactory.fixtures)).toEqual(['project-a', 'project-b']);

    const projectARoot = repo.pathTo('project-a');
    const projectBRoot = repo.pathTo('project-b');

    repo.stageChange('project-a/packages/foo/test.js');

    const changedPackagesA = getChangedPackagesWrapper({ cwd: projectARoot });
    const changedPackagesB = getChangedPackagesWrapper({ cwd: projectBRoot });

    expect(changedPackagesA).toEqual(['@project-a/foo']);
    expect(changedPackagesB).toEqual([]);
  });

  // Do one real combined test with ignores to ensure all the path handling works
  // (the logic is mostly covered by getAllChangedPackages tests)
  it('ignores CHANGELOG, change files, and ignorePatterns in single-package repo', () => {
    repo = getReusedRepoWithBranch('single');

    repo.writeFile('change/change-abc123.json', {});
    repo.writeFile('CHANGELOG.md');
    repo.writeFile('src/foo.test.js');
    repo.writeFile('src/foo.test.js');
    repo.writeFile('tests/stuff.js');
    repo.writeFile('yarn.lock');
    repo.commitAll();

    const result = getChangedPackagesWrapper({
      repoOptions: { ignorePatterns: ['*.test.js', 'tests/**', 'yarn.lock'] },
      extraArgv: ['--verbose'],
    });
    expect(result).toEqual([]);

    const logLines = logs.getMockLines('all');
    expect(logLines).toMatch('ignored by pattern');
    expect(logLines).toMatchInlineSnapshot(`
      "[log] Checking for changes against "origin/master"
      [log] Found 4 changed files in current branch (before filtering)
      [log]   - ~~CHANGELOG.md~~ (ignored by pattern "CHANGELOG.{md,json}")
      [log]   - ~~change/change-abc123.json~~ (ignored by pattern "change/*.json")
      [log]   - ~~src/foo.test.js~~ (ignored by pattern "*.test.js")
      [log]   - ~~tests/stuff.js~~ (ignored by pattern "tests/**")
      [log] All files were ignored"
    `);
  });

  it('includes staged files', () => {
    // need a separate repo since it stages changes
    repo = singleFactory.cloneRepository();
    repo.checkout('-b', 'test-staged');
    // write this file and modify it
    repo.commitChange('src/foo.js');
    repo.writeFile('src/bar.js');
    // add a new file that's only staged
    repo.writeFile('src/foo.js');
    repo.git(['add', '-A']);

    const result = getChangedPackagesWrapper({ extraArgv: ['--verbose'] });
    expect(result).toEqual(['foo']);
    // src/foo.js is both committed and staged, but should be listed only once
    expect(logs.getMockLines('all')).toContain('Found 2 changed files in current branch (before filtering)');
  });

  it('excludes packages that already have change files', () => {
    repo = getReusedRepoWithBranch('monorepo');

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
    repo = getReusedRepoWithBranch('monorepo');
    generateChangeFiles(['foo', 'a'], { ...getOptions().options, commit: true });

    const result = getChangedPackagesWrapper({ extraArgv: ['--all'] });
    expect(result.sort()).toEqual(['b', 'bar', 'baz']);
    expect(gitObserver).toHaveBeenCalled();
  });

  it('throws if the remote is invalid', () => {
    repo = getReusedRepoWithBranch('monorepo');
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

  it('includes catalog changes in the list of changed packages', () => {
    // This needs a separate factory since it pushes changes
    const repositoryFactory = new RepositoryFactory('monorepo');
    extraFactories.push(repositoryFactory);
    repo = repositoryFactory.cloneRepository();

    // Add catalog dependencies
    const initialCatalogs: Catalogs = { default: { react: '18.0.0', other: '1.0.0' } };
    repo.writeFile('.yarnrc.yml', catalogsToYaml(initialCatalogs));
    repo.updateJsonFile('packages/foo/package.json', { dependencies: { react: 'catalog:', other: 'catalog:' } });
    repo.updateJsonFile('packages/bar/package.json', { dependencies: { react: 'catalog:' } });
    repo.commitAll('add catalogs');
    repo.push();
    // sanity check
    expect(getCatalogs(repo.rootPath)).toEqual(initialCatalogs);

    // Update a catalog version, and make unrelated changes to verify merging
    const newCatalogs: Catalogs = { default: { react: '19.0.0', other: '1.0.0' } };
    repo.writeFile('.yarnrc.yml', catalogsToYaml(newCatalogs));
    repo.writeFile('packages/foo/test.js', '');
    repo.writeFile('packages/grouped/a/foo.ts', '');
    repo.commitAll();

    const result = getChangedPackagesWrapper({ extraArgv: ['--verbose'] });
    expect(result.sort()).toEqual(['a', 'bar', 'foo']);
    expect(logs.getMockLines('all', { sanitize: true })).toMatchInlineSnapshot(`
      "[log] Checking for changes against "origin/master"
      [log] Found 3 changed files in current branch (before filtering)
      [log]   - ~~.yarnrc.yml~~ (not in a package)
      [log]   - packages/foo/test.js
      [log]   - packages/grouped/a/foo.ts
      [log] Found 2 files in 2 packages that should be published
      [log] Checking for changes to catalog: dependencies...
      [log] catalog: dependencies referenced by the following packages have changed:
      [log]   - bar: react
      [log]   - foo: react"
    `);
  });
});
