import fs from 'fs-extra';
import { RepositoryFactory } from '../__fixtures__/repository';
import { git } from 'workspace-tools';
import { change } from '../commands/change';
import { BeachballOptions } from '../types/BeachballOptions';
import { getChangePath } from '../paths';
import path from 'path';

describe('change command', () => {
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

  it('create change file but git stage only', async () => {
    repositoryFactory = new RepositoryFactory();
    repositoryFactory.create();
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

    const output = git(['status', '-s'], { cwd: repo.rootPath });
    expect(output.success).toBeTruthy();
    expect(output.stdout.startsWith('A')).toBeTruthy();

    const changeFiles = getChangeFiles(repo.rootPath);
    expect(changeFiles.length).toBe(1);
  });

  it('create change file but git stage only multiple changes', async () => {
    repositoryFactory = new RepositoryFactory();
    repositoryFactory.create();
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

    const output = git(['status', '-s'], { cwd: repo.rootPath });
    expect(output.success).toBeTruthy();
    expect(output.stdout.startsWith('A')).toBeTruthy();

    const changeFiles = getChangeFiles(repo.rootPath);
    for (const file of changeFiles) {
      const contents = await fs.readJSON(path.join(repo.rootPath, 'change', file));
      expect(contents.changes.length).toBe(2);
    }

    expect(changeFiles.length).toBe(1);
  });

  it('create change file and commit', async () => {
    repositoryFactory = new RepositoryFactory();
    repositoryFactory.create();
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

    const output = git(['status', '-s'], { cwd: repo.rootPath });
    expect(output.success).toBeTruthy();
    expect(output.stdout.length).toBe(0);

    const changeFiles = getChangeFiles(repo.rootPath);
    expect(changeFiles.length).toBe(1);
  });
});
