import { describe, expect, it, afterEach } from '@jest/globals';
import { defaultRemoteBranchName } from '../__fixtures__/gitDefaults';
import { RepositoryFactory } from '../__fixtures__/repositoryFactory';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import type { BeachballOptions, RepoOptions } from '../types/BeachballOptions';
import { getChangedPackages } from '../changefile/getChangedPackages';
import { initMockLogs } from '../__fixtures__/mockLogs';
import { generateChangeFiles } from '../__fixtures__/changeFiles';
import type { Repository } from '../__fixtures__/repository';
import { getParsedOptions } from '../options/getOptions';

describe('getChangedPackages', () => {
  let repositoryFactory: RepositoryFactory | undefined;
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
    return { packageInfos, options: parsedOptions.options, parsedOptions };
  }

  afterEach(() => {
    repositoryFactory?.cleanUp();
    repositoryFactory = undefined;
    repo = undefined;
  });

  it('detects changed files in single repo', () => {
    repositoryFactory = new RepositoryFactory('single');
    repo = repositoryFactory.cloneRepository();
    const { packageInfos, options } = getOptionsAndPackages();

    // no changed packages if no changes
    expect(getChangedPackages(options, packageInfos)).toStrictEqual([]);

    // no changed packages if CHANGELOG
    repo.stageChange('CHANGELOG.md');
    expect(getChangedPackages(options, packageInfos)).toStrictEqual([]);

    repo.stageChange('foo.js');
    expect(getChangedPackages(options, packageInfos)).toStrictEqual(['foo']);
  });

  it('respects ignorePatterns option', () => {
    repositoryFactory = new RepositoryFactory('single');
    repo = repositoryFactory.cloneRepository();

    const { packageInfos, options } = getOptionsAndPackages({
      repoOptions: { ignorePatterns: ['*.test.js', 'tests/**', 'yarn.lock'] },
      extraArgv: ['--verbose'],
    });

    repo.stageChange('src/foo.test.js');
    repo.stageChange('tests/stuff.js');
    repo.stageChange('yarn.lock');

    expect(getChangedPackages(options, packageInfos)).toStrictEqual([]);
    const logLines = logs.getMockLines('all');
    expect(logLines).toMatch('ignored by pattern');
    expect(logLines).toMatchInlineSnapshot(`
      "[log] Found 2 changed files in branch "origin/master" (before filtering)
      [log]   - ~~src/foo.test.js~~ (ignored by pattern "*.test.js")
      [log]   - ~~tests/stuff.js~~ (ignored by pattern "tests/**")
      [log] All files were ignored"
    `);
  });

  it('detects changed files in monorepo', () => {
    repositoryFactory = new RepositoryFactory('monorepo');
    repo = repositoryFactory.cloneRepository();

    const { packageInfos, options } = getOptionsAndPackages();

    expect(getChangedPackages(options, packageInfos)).toStrictEqual([]);

    repo.stageChange('packages/foo/test.js');
    expect(getChangedPackages(options, packageInfos)).toStrictEqual(['foo']);
  });

  it('excludes packages that already have change files', () => {
    repositoryFactory = new RepositoryFactory('monorepo');
    repo = repositoryFactory.cloneRepository();

    const { packageInfos, options } = getOptionsAndPackages({ extraArgv: ['--verbose'] });

    // setup: create branch, change foo, create a change file, commit
    repo.checkout('-b', 'test');
    repo.commitChange('packages/foo/test.js');
    generateChangeFiles(['foo'], options);
    logs.clear();

    // foo is not included in changed packages
    let changedPackages = getChangedPackages(options, packageInfos);
    const logLines = logs.getMockLines('all', true);
    expect(logLines).toMatch(/Your local repository already has change files for these packages:\s+foo/);
    expect(logLines).toMatchInlineSnapshot(`
      "[log] Found 2 changed files in branch "origin/master" (before filtering)
      [log]   - ~~change/foo-<guid>.json~~ (ignored by pattern "change/*.json")
      [log]   - packages/foo/test.js
      [log] Found 1 file in 1 package that should be published
      [log] Your local repository already has change files for these packages:
        foo"
    `);
    expect(changedPackages).toStrictEqual([]);
    logs.clear();

    // change bar => bar is the only changed package returned
    repo.stageChange('packages/bar/test.js');
    changedPackages = getChangedPackages(options, packageInfos);
    expect(logs.getMockLines('all', true)).toMatchInlineSnapshot(`
      "[log] Found 3 changed files in branch "origin/master" (before filtering)
      [log]   - ~~change/foo-<guid>.json~~ (ignored by pattern "change/*.json")
      [log]   - packages/foo/test.js
      [log]   - packages/bar/test.js
      [log] Found 2 files in 2 packages that should be published
      [log] Your local repository already has change files for these packages:
        foo"
    `);
    expect(changedPackages).toStrictEqual(['bar']);
  });

  it('ignores package changes as appropriate', () => {
    // Due to cost of fixtures, test various ignore scenarios together
    repositoryFactory = new RepositoryFactory({
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
    repo = repositoryFactory.cloneRepository();
    repo.stageChange('packages/private-pkg/test.js');
    repo.stageChange('packages/no-publish/test.js');
    repo.stageChange('packages/out-of-scope/test.js');
    repo.stageChange('packages/ignore-pkg/jest.config.js');
    repo.stageChange('packages/ignore-pkg/CHANGELOG.md');
    repo.stageChange('packages/publish-me/test.js');

    const { packageInfos, options } = getOptionsAndPackages({
      repoOptions: {
        scope: ['!packages/out-of-scope'],
        ignorePatterns: ['**/jest.config.js'],
      },
      extraArgv: ['--verbose'],
    });

    const changedPackages = getChangedPackages(options, packageInfos);
    const logLines = logs.getMockLines('all');
    // check individual cases
    expect(logLines).toMatch('private-pkg is private');
    expect(logLines).toMatch('no-publish has beachball.shouldPublish=false');
    expect(logLines).toMatch('out-of-scope is out of scope');
    expect(logLines).toMatch('ignored by pattern "**/jest.config.js"');
    expect(logLines).toMatch('ignored by pattern "CHANGELOG.{md,json}"');
    // and overall output
    expect(logLines).toMatchInlineSnapshot(`
      "[log] Found 6 changed files in branch "origin/master" (before filtering)
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
    repositoryFactory = new RepositoryFactory('multi-workspace');
    repo = repositoryFactory.cloneRepository();
    const { options: rootOptions, packageInfos: rootPackageInfos } = getOptionsAndPackages();
    expect(Object.keys(repositoryFactory.fixtures)).toEqual(['workspace-a', 'workspace-b']);

    const workspaceARoot = repo.pathTo('workspace-a');
    const workspaceBRoot = repo.pathTo('workspace-b');

    expect(getChangedPackages(rootOptions, rootPackageInfos)).toStrictEqual([]);

    repo.stageChange('workspace-a/packages/foo/test.js');

    const infoA = getOptionsAndPackages({ cwd: workspaceARoot });
    const infoB = getOptionsAndPackages({ cwd: workspaceBRoot });
    const changedPackagesA = getChangedPackages(infoA.options, infoA.packageInfos);
    const changedPackagesB = getChangedPackages(infoB.options, infoB.packageInfos);
    const changedPackagesRoot = getChangedPackages(rootOptions, rootPackageInfos);

    expect(changedPackagesA).toStrictEqual(['@workspace-a/foo']);
    expect(changedPackagesB).toStrictEqual([]);
    expect(changedPackagesRoot).toStrictEqual(['@workspace-a/foo']);
  });

  it('returns all packages with --all option', () => {
    repositoryFactory = new RepositoryFactory('monorepo');
    repo = repositoryFactory.cloneRepository();

    const { packageInfos, options } = getOptionsAndPackages({ extraArgv: ['--all'] });

    expect(getChangedPackages(options, packageInfos).sort()).toStrictEqual(['a', 'b', 'bar', 'baz', 'foo']);
  });
});
