import fs from 'fs-extra';
import { RepositoryFactory } from '../fixtures/repository';
import { git } from 'workspace-tools';
import { change } from '../commands/change';
import { BeachballOptions } from '../types/BeachballOptions';
import { getChangePath } from '../paths';

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
      type: 'prerelease',
      dependentChangeType: 'patch',
      package: 'pkg-1',
      message: 'commit me please',
      path: repo.rootPath,
      prereleasePrefix: 'beta',
    } as BeachballOptions);

    const output = git(['status', '-s'], { cwd: repo.rootPath });
    expect(output.success).toBeTruthy();
    expect(output.stdout.length).toBe(0);

    const changeFiles = getChangeFiles(repo.rootPath);
    expect(changeFiles.length).toBe(1);
  });
});
