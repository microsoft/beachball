import fs from 'fs-extra';
import { getChangeFiles } from '../__fixtures__/changeFiles';
import { initMockLogs } from '../__fixtures__/mockLogs';
import { RepositoryFactory } from '../__fixtures__/repository';
import { change } from '../commands/change';
import { BeachballOptions } from '../types/BeachballOptions';

describe('change command', () => {
  let repositoryFactory: RepositoryFactory | undefined;

  initMockLogs();

  afterEach(() => {
    if (repositoryFactory) {
      repositoryFactory.cleanUp();
      repositoryFactory = undefined;
    }
  });

  it('create change file but git stage only', async () => {
    repositoryFactory = new RepositoryFactory();
    const repo = repositoryFactory.cloneRepository();

    repo.commitChange(
      'packages/pkg-1/package.json',
      JSON.stringify({
        name: 'pkg-1',
        version: '1.0.0',
      })
    );

    await change({
      type: 'minor',
      dependentChangeType: 'patch',
      package: 'pkg-1',
      message: 'stage me please',
      path: repo.rootPath,
      commit: false,
    } as BeachballOptions);

    expect(repo.status()).toMatch(/^A  change/);

    const changeFiles = getChangeFiles(repo.rootPath);
    expect(changeFiles).toHaveLength(1);
  });

  it('create change file but git stage only multiple changes', async () => {
    repositoryFactory = new RepositoryFactory();
    const repo = repositoryFactory.cloneRepository();

    repo.commitChange(
      'packages/pkg-1/package.json',
      JSON.stringify({
        name: 'pkg-1',
        version: '1.0.0',
      })
    );
    repo.commitChange(
      'packages/pkg-2/package.json',
      JSON.stringify({
        name: 'pkg-2',
        version: '2.0.0',
      })
    );

    await change({
      type: 'minor',
      dependentChangeType: 'patch',
      package: ['pkg-1', 'pkg-2'],
      message: 'stage me please',
      path: repo.rootPath,
      commit: false,
      groupChanges: true,
    } as BeachballOptions);

    expect(repo.status()).toMatch(/^A  change/);

    const changeFiles = getChangeFiles(repo.rootPath);
    for (const file of changeFiles) {
      const contents = await fs.readJSON(file);
      expect(contents.changes).toHaveLength(2);
    }

    expect(changeFiles).toHaveLength(1);
  });

  it('create change file and commit', async () => {
    repositoryFactory = new RepositoryFactory();
    const repo = repositoryFactory.cloneRepository();

    repo.commitChange(
      'packages/pkg-1/package.json',
      JSON.stringify({
        name: 'pkg-1',
        version: '1.0.0',
      })
    );

    await change({
      type: 'minor',
      dependentChangeType: 'patch',
      package: 'pkg-1',
      message: 'commit me please',
      path: repo.rootPath,
    } as BeachballOptions);

    expect(repo.status()).toBe('');

    const changeFiles = getChangeFiles(repo.rootPath);
    expect(changeFiles).toHaveLength(1);
  });
});
