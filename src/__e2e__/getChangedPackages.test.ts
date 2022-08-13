import { defaultBranchName } from '../__fixtures__/gitDefaults';
import { RepositoryFactory } from '../__fixtures__/repositoryFactory';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import { BeachballOptions } from '../types/BeachballOptions';
import { getChangedPackages } from '../changefile/getChangedPackages';

describe('getChangedPackages', () => {
  let repositoryFactory: RepositoryFactory | undefined;

  afterEach(() => {
    if (repositoryFactory) {
      repositoryFactory.cleanUp();
      repositoryFactory = undefined;
    }
  });

  it('detects changed files in single repo', () => {
    repositoryFactory = new RepositoryFactory('single');
    const repo = repositoryFactory.cloneRepository();
    const options = { fetch: false, path: repo.rootPath, branch: defaultBranchName } as BeachballOptions;
    const packageInfos = getPackageInfos(repo.rootPath);

    expect(getChangedPackages(options, packageInfos)).toStrictEqual([]);

    repo.stageChange('foo.js');
    expect(getChangedPackages(options, packageInfos)).toStrictEqual(['foo']);
  });

  it('respects ignorePatterns option', () => {
    repositoryFactory = new RepositoryFactory('single');
    const repo = repositoryFactory.cloneRepository();
    const options = {
      fetch: false,
      path: repo.rootPath,
      branch: defaultBranchName,
      ignorePatterns: ['*.test.js', 'tests/**', 'yarn.lock'],
    } as BeachballOptions;
    const packageInfos = getPackageInfos(repo.rootPath);

    repo.stageChange('src/foo.test.js');
    repo.stageChange('tests/stuff.js');
    repo.stageChange('yarn.lock');

    expect(getChangedPackages(options, packageInfos)).toStrictEqual([]);
  });

  it('detects changed files in monorepo', () => {
    repositoryFactory = new RepositoryFactory('monorepo');
    const repo = repositoryFactory.cloneRepository();
    const options = { fetch: false, path: repo.rootPath, branch: defaultBranchName } as BeachballOptions;
    const packageInfos = getPackageInfos(repo.rootPath);

    expect(getChangedPackages(options, packageInfos)).toStrictEqual([]);

    repo.stageChange('packages/foo/test.js');
    expect(getChangedPackages(options, packageInfos)).toStrictEqual(['foo']);
  });

  it('detects changed files in multi-monorepo (multi-workspace) repo', () => {
    repositoryFactory = new RepositoryFactory('multi-monorepo');
    const repo = repositoryFactory.cloneRepository();
    const rootOptions = { fetch: false, branch: defaultBranchName, path: repo.rootPath } as BeachballOptions;
    expect(Object.keys(repositoryFactory.fixtures)).toEqual(['repo-a', 'repo-b']);

    const repoARoot = repo.pathTo('repo-a');
    const repoBRoot = repo.pathTo('repo-b');
    const rootPackageInfos = getPackageInfos(repo.rootPath);

    expect(getChangedPackages(rootOptions, rootPackageInfos)).toStrictEqual([]);

    repo.stageChange('repo-a/packages/foo/test.js');

    const changedPackagesA = getChangedPackages({ ...rootOptions, path: repoARoot }, getPackageInfos(repoARoot));
    const changedPackagesB = getChangedPackages({ ...rootOptions, path: repoBRoot }, getPackageInfos(repoBRoot));
    const changedPackagesRoot = getChangedPackages(rootOptions, rootPackageInfos);

    expect(changedPackagesA).toStrictEqual(['@repo-a/foo']);
    expect(changedPackagesB).toStrictEqual([]);
    expect(changedPackagesRoot).toStrictEqual(['@repo-a/foo']);
  });
});
