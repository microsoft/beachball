import path from 'path';
import { git } from 'workspace-tools';
import { generateChangeFiles, getChangeFiles } from '../__fixtures__/changeFiles';
import { initMockLogs } from '../__fixtures__/mockLogs';
import { MultiMonoRepoFactory } from '../__fixtures__/multiMonorepo';
import { RepositoryFactory } from '../__fixtures__/repository';
import { bump } from '../commands/bump';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import { BeachballOptions } from '../types/BeachballOptions';

describe('version bumping', () => {
  let repositoryFactory: RepositoryFactory | undefined;

  initMockLogs();

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

    generateChangeFiles([{ packageName: '@repo-a/foo' }], repoARoot);
    generateChangeFiles([{ packageName: '@repo-a/foo', type: 'major' }], repoBRoot);

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
