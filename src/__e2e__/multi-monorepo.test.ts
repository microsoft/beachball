import fs from 'fs-extra';
import path from 'path';
import { RepositoryFactory } from '../fixtures/repository';
import { writeChangeFiles } from '../changefile/writeChangeFiles';
import { git } from '../git';
import { bump } from '../commands/bump';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import { BeachballOptions } from '../types/BeachballOptions';
import { getChangePath } from '../paths';
import { MultiMonoRepoFactory } from '../fixtures/multi-monorepo';

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

  it('bump workspace package', async () => {
    repositoryFactory = new MultiMonoRepoFactory();
    await repositoryFactory.create();
    const repo = await repositoryFactory.cloneRepository();

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

    git(['push', 'origin', 'master'], { cwd: repo.rootPath });

    await bump({ path: repoARoot, bumpDeps: true } as BeachballOptions);

    const packageInfosA = getPackageInfos(repoARoot);
    expect(packageInfosA['foo'].version).toBe('1.1.0');

    const packageInfosB = getPackageInfos(repoBRoot);
    expect(packageInfosB['foo'].version).toBe('1.0.0');

    const changeFilesA = getChangeFiles(repoARoot);
    expect(changeFilesA.length).toBe(0);

    const changeFilesB = getChangeFiles(repoBRoot);
    expect(changeFilesB.length).toBe(0);
  });

  it('should not bump out-of-workspace package even if package has change', async () => {
    repositoryFactory = new MultiMonoRepoFactory();
    await repositoryFactory.create();
    const repo = await repositoryFactory.cloneRepository();

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
      repoBRoot
    );

    git(['push', 'origin', 'master'], { cwd: repo.rootPath });

    await bump({ path: repoARoot, bumpDeps: true } as BeachballOptions);

    const packageInfosA = getPackageInfos(repoARoot);
    expect(packageInfosA['foo'].version).toBe('1.0.0');

    const packageInfosB = getPackageInfos(repoBRoot);
    expect(packageInfosB['foo'].version).toBe('1.0.0');

    const changeFilesA = getChangeFiles(repoARoot);
    expect(changeFilesA.length).toBe(0);

    const changeFilesB = getChangeFiles(repoBRoot);
    expect(changeFilesB.length).toBe(1);
  });
});
