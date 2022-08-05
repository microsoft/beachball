import fs from 'fs-extra';
import path from 'path';
import { RepositoryFactory } from '../__fixtures__/repository';
import { writeChangeFiles } from '../changefile/writeChangeFiles';
import { git } from 'workspace-tools';
import { bump } from '../commands/bump';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import { BeachballOptions } from '../types/BeachballOptions';
import { getChangePath } from '../paths';
import { MultiMonoRepoFactory } from '../__fixtures__/multiMonorepo';

describe('version bumping', () => {
  let repositoryFactory: RepositoryFactory | undefined;

  function getChangeFiles(cwd: string): string[] {
    const changePath = getChangePath(cwd);
    const changeFiles = changePath && fs.existsSync(changePath) ? fs.readdirSync(changePath) : [];
    return changeFiles;
  }

  afterEach(() => {
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

    writeChangeFiles({
      changes: [
        {
          type: 'minor',
          comment: 'test',
          email: 'test@test.com',
          packageName: '@repo-a/foo',
          dependentChangeType: 'patch',
        },
      ],
      cwd: repoARoot,
    });

    writeChangeFiles({
      changes: [
        {
          type: 'major',
          comment: 'test',
          email: 'test@test.com',
          packageName: '@repo-b/foo',
          dependentChangeType: 'patch',
        },
      ],
      cwd: repoBRoot,
    });

    git(['push', 'origin', 'master'], { cwd: repo.rootPath });

    await bump({ path: repoARoot, bumpDeps: true } as BeachballOptions);

    const packageInfosA = getPackageInfos(repoARoot);
    const packageInfosB = getPackageInfos(repoBRoot);
    expect(packageInfosA['@repo-a/foo'].version).toBe('1.1.0');
    expect(packageInfosB['@repo-b/foo'].version).toBe('1.0.0');

    const changeFilesA = getChangeFiles(repoARoot);
    const changeFilesB = getChangeFiles(repoBRoot);
    expect(changeFilesA.length).toBe(0);
    expect(changeFilesB.length).toBe(1);
  });
});
