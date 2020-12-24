import fs from 'fs-extra';
import path from 'path';
import { RepositoryFactory } from '../fixtures/repository';
import { getChangedPackages } from '../changefile/getChangedPackages';
import { writeChangeFiles } from '../changefile/writeChangeFiles';
import { git } from '../git';
import { bump } from '../commands/bump';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import { BeachballOptions } from '../types/BeachballOptions';
import { getChangePath } from '../paths';
import { MultiMonoRepoFactory } from '../fixtures/multi-monorepo';

describe('changed files', () => {
  let repositoryFactory: RepositoryFactory | undefined;

  afterEach(async () => {
    if (repositoryFactory) {
      repositoryFactory.cleanUp();
      repositoryFactory = undefined;
    }
  });

  it('detects changed files in workspace', async () => {
    repositoryFactory = new MultiMonoRepoFactory();
    repositoryFactory.create();
    const repo = repositoryFactory.cloneRepository();

    const repoARoot = path.join(repo.rootPath, 'repo-a');
    const repoBRoot = path.join(repo.rootPath, 'repo-b');

    const testFilePath = path.join(repoARoot, 'packages/foo/test.js');
    fs.writeFileSync(testFilePath, '');
    git(['add', testFilePath], { cwd: repoARoot });

    const changedPackagesA = getChangedPackages({
      fetch: false,
      path: repoARoot,
      branch: 'master',
    } as BeachballOptions);

    const changedPackagesB = getChangedPackages({
      fetch: false,
      path: repoBRoot,
      branch: 'master',
    } as BeachballOptions);

    const changedPackagesRoot = getChangedPackages({
      fetch: false,
      path: repo.rootPath,
      branch: 'master',
    } as BeachballOptions);

    expect(changedPackagesA).toStrictEqual(['foo']);
    expect(changedPackagesB).toStrictEqual([]);
    expect(changedPackagesRoot).toStrictEqual(['foo']);
  });
});

describe('version bumping', () => {
  let repositoryFactory: RepositoryFactory | undefined;

  function getChangeFiles(cwd: string): string[] {
    const changePath = getChangePath(cwd);
    const changeFiles = changePath && fs.existsSync(changePath) ? fs.readdirSync(changePath) : [];
    return changeFiles;
  }

  afterEach(async () => {
    if (repositoryFactory) {
      repositoryFactory.cleanUp();
      repositoryFactory = undefined;
    }
  });

  it('only bumps workspace package', async () => {
    repositoryFactory = new MultiMonoRepoFactory();
    repositoryFactory.create();
    const repo = repositoryFactory.cloneRepository();

    const repoARoot = path.join(repo.rootPath, 'repo-a');
    const repoBRoot = path.join(repo.rootPath, 'repo-b');

    writeChangeFiles(
      {
        foo: {
          type: 'minor',
          comment: 'test',
          email: 'test@test.com',
          packageName: 'foo',
          dependentChangeType: 'patch',
        },
      },
      repoARoot
    );

    writeChangeFiles(
      {
        foo: {
          type: 'major',
          comment: 'test',
          email: 'test@test.com',
          packageName: 'foo',
          dependentChangeType: 'patch',
        },
      },
      repoBRoot
    );

    git(['push', 'origin', 'master'], { cwd: repo.rootPath });

    await bump({ path: repoARoot, bumpDeps: true } as BeachballOptions);

    const packageInfosA = getPackageInfos(repoARoot);
    const packageInfosB = getPackageInfos(repoBRoot);
    expect(packageInfosA['foo'].version).toBe('1.1.0');
    expect(packageInfosB['foo'].version).toBe('1.0.0');

    const changeFilesA = getChangeFiles(repoARoot);
    const changeFilesB = getChangeFiles(repoBRoot);
    expect(changeFilesA.length).toBe(0);
    expect(changeFilesB.length).toBe(1);
  });
});
