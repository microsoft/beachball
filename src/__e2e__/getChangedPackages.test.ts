import { describe, expect, it, afterEach } from '@jest/globals';
import { defaultBranchName } from '../__fixtures__/gitDefaults';
import { RepositoryFactory } from '../__fixtures__/repositoryFactory';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import type { BeachballOptions } from '../types/BeachballOptions';
import { getChangedPackages } from '../changefile/getChangedPackages';
import { initMockLogs } from '../__fixtures__/mockLogs';
import { generateChangeFiles } from '../__fixtures__/changeFiles';
import type { Repository } from '../__fixtures__/repository';
import { getDefaultOptions } from '../options/getDefaultOptions';

describe('getChangedPackages', () => {
  let repositoryFactory: RepositoryFactory | undefined;
  let repo: Repository | undefined;
  const logs = initMockLogs();

  function getOptions(options?: Partial<BeachballOptions>): BeachballOptions {
    return {
      ...getDefaultOptions(),
      // change to ?. if a future test uses a non-standard repo
      path: repo!.rootPath,
      branch: defaultBranchName,
      fetch: false,
      ...options,
    };
  }

  afterEach(() => {
    repositoryFactory?.cleanUp();
    repositoryFactory = undefined;
    repo = undefined;
  });

  it('detects changed files in single repo', () => {
    repositoryFactory = new RepositoryFactory('single');
    repo = repositoryFactory.cloneRepository();
    const packageInfos = getPackageInfos(repo.rootPath);

    const options = getOptions();

    expect(getChangedPackages(options, packageInfos)).toStrictEqual([]);

    repo.stageChange('foo.js');
    expect(getChangedPackages(options, packageInfos)).toStrictEqual(['foo']);
  });

  it('respects ignorePatterns option', () => {
    repositoryFactory = new RepositoryFactory('single');
    repo = repositoryFactory.cloneRepository();
    const packageInfos = getPackageInfos(repo.rootPath);

    const options = getOptions({
      ignorePatterns: ['*.test.js', 'tests/**', 'yarn.lock'],
      verbose: true,
    });

    repo.stageChange('src/foo.test.js');
    repo.stageChange('tests/stuff.js');
    repo.stageChange('yarn.lock');

    const changedPackages = getChangedPackages(options, packageInfos);
    const logLines = logs.getMockLines('all');
    expect(logLines).toMatch('ignored by pattern');
    expect(logLines).toMatchInlineSnapshot(`
      "[log] Found 2 changed files in branch "master" (before filtering)
      [log]   - ~~src/foo.test.js~~ (ignored by pattern "*.test.js")
      [log]   - ~~tests/stuff.js~~ (ignored by pattern "tests/**")
      [log] All files were ignored"
      `);
    expect(changedPackages).toStrictEqual([]);
  });

  it('detects changed files in monorepo', () => {
    repositoryFactory = new RepositoryFactory('monorepo');
    repo = repositoryFactory.cloneRepository();
    const packageInfos = getPackageInfos(repo.rootPath);

    const options = getOptions();

    expect(getChangedPackages(options, packageInfos)).toStrictEqual([]);

    repo.stageChange('packages/foo/test.js');
    expect(getChangedPackages(options, packageInfos)).toStrictEqual(['foo']);
  });

  it('excludes packages that already have change files', () => {
    repositoryFactory = new RepositoryFactory('monorepo');
    repo = repositoryFactory.cloneRepository();

    const options = getOptions({ verbose: true });

    // setup: create branch, change foo, create a change file, commit
    repo.checkout('-b', 'test');
    repo.commitChange('packages/foo/test.js');
    generateChangeFiles(['foo'], options);
    logs.clear();

    const packageInfos = getPackageInfos(repo.rootPath);

    // foo is not included in changed packages
    let changedPackages = getChangedPackages(options, packageInfos);
    const logLines = logs.getMockLines('all', true);
    expect(logLines).toMatch(/Your local repository already has change files for these packages:\s+foo/);
    expect(logLines).toMatchInlineSnapshot(`
      "[log] Found 2 changed files in branch "master" (before filtering)
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
      "[log] Found 3 changed files in branch "master" (before filtering)
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

    const options = getOptions({
      scope: ['!packages/out-of-scope'],
      ignorePatterns: ['**/jest.config.js'],
      verbose: true,
    });
    const packageInfos = getPackageInfos(repo.rootPath);

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
      "[log] Found 6 changed files in branch "master" (before filtering)
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

  it('detects changed files in multi-monorepo (multi-workspace) repo', () => {
    repositoryFactory = new RepositoryFactory('multi-workspace');
    repo = repositoryFactory.cloneRepository();
    const rootOptions = getOptions();
    expect(Object.keys(repositoryFactory.fixtures)).toEqual(['workspace-a', 'workspace-b']);

    const workspaceARoot = repo.pathTo('workspace-a');
    const workspaceBRoot = repo.pathTo('workspace-b');
    const rootPackageInfos = getPackageInfos(repo.rootPath);

    expect(getChangedPackages(rootOptions, rootPackageInfos)).toStrictEqual([]);

    repo.stageChange('workspace-a/packages/foo/test.js');

    const changedPackagesA = getChangedPackages(
      { ...rootOptions, path: workspaceARoot },
      getPackageInfos(workspaceARoot)
    );
    const changedPackagesB = getChangedPackages(
      { ...rootOptions, path: workspaceBRoot },
      getPackageInfos(workspaceBRoot)
    );
    const changedPackagesRoot = getChangedPackages(rootOptions, rootPackageInfos);

    expect(changedPackagesA).toStrictEqual(['@workspace-a/foo']);
    expect(changedPackagesB).toStrictEqual([]);
    expect(changedPackagesRoot).toStrictEqual(['@workspace-a/foo']);
  });

  it('returns all packages with --all option', () => {
    repositoryFactory = new RepositoryFactory('monorepo');
    repo = repositoryFactory.cloneRepository();
    const packageInfos = getPackageInfos(repo.rootPath);

    const options = getOptions({ all: true });

    expect(getChangedPackages(options, packageInfos).sort()).toStrictEqual(['a', 'b', 'bar', 'baz', 'foo']);
  });
});
