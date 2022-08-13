import { generateChangeFiles, getChangeFiles } from '../__fixtures__/changeFiles';
import { initMockLogs } from '../__fixtures__/mockLogs';
import { RepositoryFactory } from '../__fixtures__/repositoryFactory';
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
    repositoryFactory = new RepositoryFactory('multi-monorepo');
    const repo = repositoryFactory.cloneRepository();
    expect(Object.keys(repositoryFactory.fixtures)).toEqual(['repo-a', 'repo-b']);

    const repoARoot = repo.pathTo('repo-a');
    const repoBRoot = repo.pathTo('repo-b');

    generateChangeFiles([{ packageName: '@repo-a/foo' }], repoARoot);
    generateChangeFiles([{ packageName: '@repo-a/foo', type: 'major' }], repoBRoot);

    repo.push();

    await bump({ path: repoARoot, bumpDeps: true } as BeachballOptions);

    const packageInfosA = getPackageInfos(repoARoot);
    const packageInfosB = getPackageInfos(repoBRoot);
    expect(packageInfosA['@repo-a/foo'].version).toBe('1.1.0');
    expect(packageInfosB['@repo-b/foo'].version).toBe('1.0.0');

    const changeFilesA = getChangeFiles(repoARoot);
    const changeFilesB = getChangeFiles(repoBRoot);
    expect(changeFilesA).toHaveLength(0);
    expect(changeFilesB).toHaveLength(1);
  });
});
