import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { addGitObserver, clearGitObservers } from 'workspace-tools';
import { defaultRemoteBranchName } from '../../__fixtures__/gitDefaults';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import type { Repository } from '../../__fixtures__/repository';
import { RepositoryFactory } from '../../__fixtures__/repositoryFactory';
import { getAllChangedPackages } from '../../changefile/getAllChangedPackages';
import { getPackageInfos } from '../../monorepo/getPackageInfos';
import { getScopedPackages } from '../../monorepo/getScopedPackages';
import { getParsedOptions } from '../../options/getOptions';
import type { RepoOptions } from '../../types/BeachballOptions';

describe('getAllChangedPackages', () => {
  const gitObserver = jest.fn();
  const logs = initMockLogs();

  let singleFactory: RepositoryFactory;
  let monorepoFactory: RepositoryFactory;
  let multiFactory: RepositoryFactory;

  /** Repos reused for most tests (don't use directly) */
  let _reusedRepos: {
    single: Repository;
    monorepo: Repository;
  };

  /** Repo for current test */
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

  /** Get options/context, clear `gitObserver` mock, and call `getAllChangedPackages` */
  function getAllChangedPackagesWrapper(
    params: { repoOptions?: Partial<RepoOptions>; extraArgv?: string[]; cwd?: string } = {}
  ) {
    const { repoOptions, extraArgv = [], cwd = repo!.rootPath } = params;
    const parsedOptions = getParsedOptions({
      cwd,
      argv: ['node', 'beachball', 'change', ...extraArgv],
      env: {},
      testRepoOptions: {
        fetch: false,
        branch: defaultRemoteBranchName,
        ...repoOptions,
      },
    });
    const packageInfos = getPackageInfos(parsedOptions);
    const scopedPackages = getScopedPackages(parsedOptions.options, packageInfos);
    gitObserver.mockClear();
    return getAllChangedPackages({
      options: parsedOptions.options,
      packageInfos,
      scopedPackages,
    });
  }

  beforeAll(() => {
    singleFactory = new RepositoryFactory('single');
    monorepoFactory = new RepositoryFactory('monorepo');
    multiFactory = new RepositoryFactory('multi-project');
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
    // clean up the factories and all clones
    singleFactory.cleanUp();
    monorepoFactory.cleanUp();
    multiFactory.cleanUp();
    clearGitObservers();
  });

  it.each(['single', 'monorepo'] as const)('returns empty list when no changes have been made (%s)', type => {
    repo = getReusedRepoWithBranch(type);
    expect(getAllChangedPackagesWrapper()).toEqual([]);
    expect(gitObserver).toHaveBeenCalled();
  });

  it('detects changed files in single-package repo', () => {
    repo = getReusedRepoWithBranch('single');
    repo.commitChange('myFilename');
    expect(getAllChangedPackagesWrapper()).toEqual(['foo']);
    expect(gitObserver).toHaveBeenCalled();
  });

  it('detects changed files in monorepo', () => {
    repo = getReusedRepoWithBranch('monorepo');
    repo.writeFile('packages/foo/myFilename');
    repo.writeFile('not-package/file');
    repo.commitAll();
    expect(getAllChangedPackagesWrapper()).toEqual(['foo']);
    expect(gitObserver).toHaveBeenCalled();
  });

  // Due to test cost, combine ignorePatterns and implicit CHANGELOG ignore
  it('ignores CHANGELOG, change files, and ignorePatterns in single-package repo', () => {
    repo = getReusedRepoWithBranch('single');

    repo.writeFile('change/change-abc123.json');
    repo.writeFile('CHANGELOG.md');
    repo.writeFile('src/foo.test.js');
    repo.writeFile('src/foo.test.js');
    repo.writeFile('tests/stuff.js');
    repo.writeFile('yarn.lock');
    repo.commitAll();

    const result = getAllChangedPackagesWrapper({
      repoOptions: { ignorePatterns: ['*.test.js', 'tests/**', 'yarn.lock'] },
      extraArgv: ['--verbose'],
    });
    expect(result).toEqual([]);

    const logLines = logs.getMockLines('all');
    expect(logLines).toMatch('ignored by pattern');
    expect(logLines).toMatchInlineSnapshot(`
      "[log] Found 4 changed files in current branch (before filtering)
      [log]   - ~~CHANGELOG.md~~ (ignored by pattern "CHANGELOG.{md,json}")
      [log]   - ~~change/change-abc123.json~~ (ignored by pattern "change/*.json")
      [log]   - ~~src/foo.test.js~~ (ignored by pattern "*.test.js")
      [log]   - ~~tests/stuff.js~~ (ignored by pattern "tests/**")
      [log] All files were ignored"
    `);
  });

  // Due to test cost, combine ignorePatterns and implicit CHANGELOG ignore
  // (in a monorepo, change files are outside a package and should be ignored automatically)
  it('ignores CHANGELOG.* and respects ignorePatterns in monorepo', () => {
    repo = getReusedRepoWithBranch('monorepo');
    repo.writeFile('packages/foo/CHANGELOG.md');
    repo.writeFile('packages/foo/CHANGELOG.json');
    repo.writeFile('packages/bar/foo.ts');
    repo.writeFile('packages/baz/foo.js');
    repo.commitAll();

    const result = getAllChangedPackagesWrapper({
      repoOptions: { ignorePatterns: ['**/*.js'] },
      extraArgv: ['--verbose'],
    });
    expect(result).toEqual(['bar']);
    expect(gitObserver).toHaveBeenCalled();

    expect(logs.getMockLines('all')).toMatchInlineSnapshot(`
      "[log] Found 4 changed files in current branch (before filtering)
      [log]   - ~~packages/baz/foo.js~~ (ignored by pattern "**/*.js")
      [log]   - ~~packages/foo/CHANGELOG.json~~ (ignored by pattern "CHANGELOG.{md,json}")
      [log]   - ~~packages/foo/CHANGELOG.md~~ (ignored by pattern "CHANGELOG.{md,json}")
      [log]   - packages/bar/foo.ts
      [log] Found 1 file in 1 package that should be published"
    `);
  });

  it('detects staged file changes (respecting ignores) but ignores untracked changes', () => {
    // This creates uncommitted files, so it needs a separate clone
    repo = monorepoFactory.cloneRepository();

    // only foo has a non-ignored change
    repo.writeFile('packages/foo/foo.js');
    repo.writeFile('packages/bar/baz.js');
    repo.writeFile('packages/baz/jest.config.js');
    repo.git(['add', '-A']);
    // bar also has an untracked change that should be ignored
    repo.writeFile('packages/bar/untracked.js');

    const result = getAllChangedPackagesWrapper({
      repoOptions: { ignorePatterns: ['**/jest.config.js', 'packages/*/baz.js'] },
      extraArgv: ['--verbose'],
    });
    expect(result).toEqual(['foo']);

    expect(logs.getMockLines('all')).toMatchInlineSnapshot(`
      "[log] Found 3 changed files in current branch (before filtering)
      [log]   - ~~packages/bar/baz.js~~ (ignored by pattern "packages/*/baz.js")
      [log]   - ~~packages/baz/jest.config.js~~ (ignored by pattern "**/jest.config.js")
      [log]   - packages/foo/foo.js
      [log] Found 1 file in 1 package that should be published"
    `);
  });

  // This is tested at a lower level by isPackageIncluded.test.ts
  it('ignores package changes as appropriate', () => {
    repo = getReusedRepoWithBranch('monorepo');

    // Update packages so they'll be ignored
    repo.updateJsonFile('packages/foo/package.json', { private: true });
    repo.writeFile('packages/foo/foo.js');
    repo.updateJsonFile('packages/bar/package.json', { beachball: { shouldPublish: false } });
    repo.writeFile('packages/bar/bar.js');
    // baz is not ignored
    repo.writeFile('packages/baz/baz.js');
    // these packages will be out of scope
    repo.writeFile('packages/grouped/a/grouped.js', { dirMustExist: true });
    repo.writeFile('packages/grouped/b/grouped.js', { dirMustExist: true });
    repo.commitAll();

    const result = getAllChangedPackagesWrapper({
      repoOptions: { scope: ['!packages/grouped/*'] },
      extraArgv: ['--verbose'],
    });

    expect(result).toEqual(['baz']);
    const logLines = logs.getMockLines('all');
    expect(logLines).toMatchInlineSnapshot(`
      "[log] Found 7 changed files in current branch (before filtering)
      [log]   - ~~packages/bar/bar.js~~ (bar has beachball.shouldPublish=false)
      [log]   - ~~packages/bar/package.json~~ (bar has beachball.shouldPublish=false)
      [log]   - packages/baz/baz.js
      [log]   - ~~packages/foo/foo.js~~ (foo is private)
      [log]   - ~~packages/foo/package.json~~ (foo is private)
      [log]   - ~~packages/grouped/a/grouped.js~~ (a is out of scope)
      [log]   - ~~packages/grouped/b/grouped.js~~ (b is out of scope)
      [log] Found 1 file in 1 package that should be published"
    `);
  });

  it('detects changed files in multi-project monorepo', () => {
    // this is the only multi-project test
    repo = multiFactory.cloneRepository();
    expect(Object.keys(multiFactory.fixtures)).toEqual(['project-a', 'project-b']);

    const projectARoot = repo.pathTo('project-a');
    const projectBRoot = repo.pathTo('project-b');

    repo.stageChange('project-a/packages/foo/test.js');

    const changedPackagesA = getAllChangedPackagesWrapper({ cwd: projectARoot });
    const changedPackagesB = getAllChangedPackagesWrapper({ cwd: projectBRoot });
    const changedPackagesRoot = getAllChangedPackagesWrapper({ cwd: repo.rootPath });

    expect(changedPackagesA).toEqual(['@project-a/foo']);
    expect(changedPackagesB).toEqual([]);
    expect(changedPackagesRoot).toEqual(['@project-a/foo']);
  });
});
