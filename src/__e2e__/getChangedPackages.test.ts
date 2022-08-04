import fs from 'fs-extra';
import path from 'path';
import { RepositoryFactory } from '../__fixtures__/repository';
import { git } from 'workspace-tools';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import { BeachballOptions } from '../types/BeachballOptions';
import { MultiMonoRepoFactory } from '../__fixtures__/multiMonorepo';
import { getChangedPackages } from '../changefile/getChangedPackages';
import { MonoRepoFactory } from '../__fixtures__/monorepo';

describe('getChangedPackages', () => {
  let repositoryFactory: RepositoryFactory | undefined;

  function writeAndAdd(repoRoot: string, filePath: string) {
    const testFilePath = path.join(repoRoot, filePath);
    fs.ensureDirSync(path.dirname(testFilePath));
    fs.writeFileSync(testFilePath, '');
    git(['add', testFilePath], { cwd: repoRoot });
  }

  afterEach(() => {
    if (repositoryFactory) {
      repositoryFactory.cleanUp();
      repositoryFactory = undefined;
    }
  });

  it('detects changed files in single repo', () => {
    repositoryFactory = new RepositoryFactory();
    repositoryFactory.create();
    const repo = repositoryFactory.cloneRepository();
    const options = { fetch: false, path: repo.rootPath, branch: 'master' } as BeachballOptions;
    const packageInfos = getPackageInfos(repo.rootPath);

    expect(getChangedPackages(options, packageInfos)).toStrictEqual([]);

    writeAndAdd(repo.rootPath, 'foo.js');
    expect(getChangedPackages(options, packageInfos)).toStrictEqual(['foo']);
  });

  it('respects ignorePatterns option', () => {
    repositoryFactory = new RepositoryFactory();
    repositoryFactory.create();
    const repo = repositoryFactory.cloneRepository();
    const options = {
      fetch: false,
      path: repo.rootPath,
      branch: 'master',
      ignorePatterns: ['*.test.js', 'tests/**', 'yarn.lock'],
    } as BeachballOptions;
    const packageInfos = getPackageInfos(repo.rootPath);

    writeAndAdd(repo.rootPath, 'src/foo.test.js');
    writeAndAdd(repo.rootPath, 'tests/stuff.js');
    writeAndAdd(repo.rootPath, 'yarn.lock');

    expect(getChangedPackages(options, packageInfos)).toStrictEqual([]);
  });

  it('detects changed files in monorepo', () => {
    repositoryFactory = new MonoRepoFactory();
    repositoryFactory.create();
    const repo = repositoryFactory.cloneRepository();
    const options = { fetch: false, path: repo.rootPath, branch: 'master' } as BeachballOptions;
    const packageInfos = getPackageInfos(repo.rootPath);

    expect(getChangedPackages(options, packageInfos)).toStrictEqual([]);

    writeAndAdd(repo.rootPath, 'packages/foo/test.js');
    expect(getChangedPackages(options, packageInfos)).toStrictEqual(['foo']);
  });

  it('detects changed files in multi-monorepo workspace', () => {
    repositoryFactory = new MultiMonoRepoFactory();
    repositoryFactory.create();
    const repo = repositoryFactory.cloneRepository();
    const rootOptions = { fetch: false, branch: 'master', path: repo.rootPath } as BeachballOptions;
    const repoARoot = path.join(repo.rootPath, 'repo-a');
    const repoBRoot = path.join(repo.rootPath, 'repo-b');
    const rootPackageInfos = getPackageInfos(repo.rootPath);

    expect(getChangedPackages(rootOptions, rootPackageInfos)).toStrictEqual([]);

    writeAndAdd(repoARoot, 'packages/foo/test.js');

    const changedPackagesA = getChangedPackages({ ...rootOptions, path: repoARoot }, getPackageInfos(repoARoot));
    const changedPackagesB = getChangedPackages({ ...rootOptions, path: repoBRoot }, getPackageInfos(repoBRoot));
    const changedPackagesRoot = getChangedPackages(rootOptions, rootPackageInfos);

    expect(changedPackagesA).toStrictEqual(['foo']);
    expect(changedPackagesB).toStrictEqual([]);
    expect(changedPackagesRoot).toStrictEqual(['foo']);
  });
});
