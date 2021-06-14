import { star } from '../commands/star';
import { MonoRepoFactory } from '../fixtures/monorepo';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import { BeachballOptions } from '../types/BeachballOptions';

describe('star command', () => {
  let repositoryFactory: MonoRepoFactory | undefined;

  afterEach(async () => {
    if (repositoryFactory) {
      repositoryFactory.cleanUp();
      repositoryFactory = undefined;
    }
  });

  it('applies * to workspace dependencies', async () => {
    repositoryFactory = new MonoRepoFactory();
    await repositoryFactory.create();
    const repo = await repositoryFactory.cloneRepository();

    star({
      path: repo.rootPath,
    } as BeachballOptions);

    const packageInfos = getPackageInfos(repo.rootPath);
    expect(packageInfos['foo'].dependencies?.['bar']).toBe('*');
  });
});