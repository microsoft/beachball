import fs from 'fs-extra';
import { RepositoryFactory } from '../fixtures/repository';
import { writeChangeFiles } from '../changefile/writeChangeFiles';
import { git } from '../git';
import { bump } from '../commands/bump';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import { BeachballOptions } from '../types/BeachballOptions';
import { getChangePath } from '../paths';
import { MonoRepoFactory } from '../fixtures/monorepo';

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

  it('bumps only packages with change files', async () => {
    repositoryFactory = new RepositoryFactory();
    await repositoryFactory.create();
    const repo = await repositoryFactory.cloneRepository();

    await repo.commitChange(
      'packages/pkg-1/package.json',
      JSON.stringify({
        name: 'pkg-1',
        version: '1.0.0',
      })
    );

    await repo.commitChange(
      'packages/pkg-2/package.json',
      JSON.stringify({
        name: 'pkg-2',
        version: '1.0.0',
        dependencies: {
          'pkg-1': '1.0.0',
        },
      })
    );

    await repo.commitChange(
      'packages/pkg-3/package.json',
      JSON.stringify({
        name: 'pkg-3',
        version: '1.0.0',
        devDependencies: {
          'pkg-2': '1.0.0',
        },
      })
    );

    await repo.commitChange(
      'packages/pkg-4/package.json',
      JSON.stringify({
        name: 'pkg-4',
        version: '1.0.0',
        peerDependencies: {
          'pkg-3': '1.0.0',
        },
      })
    );

    await repo.commitChange(
      'package.json',
      JSON.stringify({
        name: 'foo-repo',
        version: '1.0.0',
        private: true,
      })
    );

    writeChangeFiles(
      {
        'pkg-1': {
          type: 'minor',
          comment: 'test',
          date: new Date('2019-01-01'),
          email: 'test@test.com',
          packageName: 'pkg-1',
          dependentChangeType: 'patch',
        },
      },
      repo.rootPath
    );

    git(['push', 'origin', 'master'], { cwd: repo.rootPath });

    await bump({ path: repo.rootPath, bumpDeps: false } as BeachballOptions);

    const packageInfos = getPackageInfos(repo.rootPath);

    expect(packageInfos['pkg-1'].version).toBe('1.1.0');
    expect(packageInfos['pkg-2'].version).toBe('1.0.0');
    expect(packageInfos['pkg-3'].version).toBe('1.0.0');

    expect(packageInfos['pkg-2'].dependencies!['pkg-1']).toBe('1.1.0');
    expect(packageInfos['pkg-3'].devDependencies!['pkg-2']).toBe('1.0.0');
    expect(packageInfos['pkg-4'].peerDependencies!['pkg-3']).toBe('1.0.0');

    const changeFiles = getChangeFiles(repo.rootPath);
    expect(changeFiles.length).toBe(0);
  });

  it('bumps only packages with change files committed between specified ref and head using `since` flag', async () => {
    repositoryFactory = new RepositoryFactory();
    await repositoryFactory.create();
    const repo = await repositoryFactory.cloneRepository();

    await repo.commitChange(
      'packages/pkg-1/package.json',
      JSON.stringify({
        name: 'pkg-1',
        version: '1.0.0',
      })
    );

    await repo.commitChange(
      'packages/pkg-2/package.json',
      JSON.stringify({
        name: 'pkg-2',
        version: '1.0.0',
        dependencies: {
          'pkg-1': '1.0.0',
        },
      })
    );

    await repo.commitChange(
      'packages/pkg-3/package.json',
      JSON.stringify({
        name: 'pkg-3',
        version: '1.0.0',
      })
    );

    await repo.commitChange(
      'package.json',
      JSON.stringify({
        name: 'foo-repo',
        version: '1.0.0',
        private: true,
      })
    );

    writeChangeFiles(
      {
        'pkg-1': {
          type: 'minor',
          comment: 'test',
          date: new Date('2019-01-01'),
          email: 'test@test.com',
          packageName: 'pkg-1',
          dependentChangeType: 'patch',
        },
      },
      repo.rootPath
    );

    const revParseOutput = git(['rev-parse', 'HEAD'], { cwd: repo.rootPath });
    if (!revParseOutput.success) {
      fail('failed to retrieve the HEAD SHA');
    }

    writeChangeFiles(
      {
        'pkg-3': {
          type: 'minor',
          comment: 'test',
          date: new Date('2019-01-02'),
          email: 'test@test.com',
          packageName: 'pkg-3',
          dependentChangeType: 'patch',
        },
      },
      repo.rootPath
    );

    git(['push', 'origin', 'master'], { cwd: repo.rootPath });

    await bump({ path: repo.rootPath, bumpDeps: false, fromRef: revParseOutput.stdout } as BeachballOptions);

    const packageInfos = getPackageInfos(repo.rootPath);

    expect(packageInfos['pkg-1'].version).toBe('1.0.0');
    expect(packageInfos['pkg-2'].version).toBe('1.0.0');
    expect(packageInfos['pkg-3'].version).toBe('1.1.0');
    expect(packageInfos['pkg-2'].dependencies!['pkg-1']).toBe('1.0.0');

    const changeFiles = getChangeFiles(repo.rootPath);
    expect(changeFiles.length).toBe(1);
  });

  it('bumps all dependent packages with `bumpDeps` flag', async () => {
    repositoryFactory = new RepositoryFactory();
    await repositoryFactory.create();
    const repo = await repositoryFactory.cloneRepository();

    await repo.commitChange(
      'packages/pkg-1/package.json',
      JSON.stringify({
        name: 'pkg-1',
        version: '1.0.0',
      })
    );

    await repo.commitChange(
      'packages/pkg-2/package.json',
      JSON.stringify({
        name: 'pkg-2',
        version: '1.0.0',
        dependencies: {
          'pkg-1': '1.0.0',
        },
      })
    );

    await repo.commitChange(
      'packages/pkg-3/package.json',
      JSON.stringify({
        name: 'pkg-3',
        version: '1.0.0',
        devDependencies: {
          'pkg-2': '1.0.0',
        },
      })
    );

    await repo.commitChange(
      'packages/pkg-4/package.json',
      JSON.stringify({
        name: 'pkg-4',
        version: '1.0.0',
        peerDependencies: {
          'pkg-3': '1.0.0',
        },
      })
    );

    await repo.commitChange(
      'package.json',
      JSON.stringify({
        name: 'foo-repo',
        version: '1.0.0',
        private: true,
      })
    );

    writeChangeFiles(
      {
        'pkg-1': {
          type: 'minor',
          comment: 'test',
          date: new Date('2019-01-01'),
          email: 'test@test.com',
          packageName: 'pkg-1',
          dependentChangeType: 'patch',
        },
      },
      repo.rootPath
    );

    git(['push', 'origin', 'master'], { cwd: repo.rootPath });

    await bump({ path: repo.rootPath, bumpDeps: true } as BeachballOptions);

    const packageInfos = getPackageInfos(repo.rootPath);

    expect(packageInfos['pkg-1'].version).toBe('1.1.0');
    expect(packageInfos['pkg-2'].version).toBe('1.0.1');
    expect(packageInfos['pkg-3'].version).toBe('1.0.1');

    expect(packageInfos['pkg-2'].dependencies!['pkg-1']).toBe('1.1.0');
    expect(packageInfos['pkg-3'].devDependencies!['pkg-2']).toBe('1.0.1');
    expect(packageInfos['pkg-4'].peerDependencies!['pkg-3']).toBe('1.0.1');

    const changeFiles = getChangeFiles(repo.rootPath);
    expect(changeFiles.length).toBe(0);
  });

  it('bumps all grouped packages', async () => {
    repositoryFactory = new RepositoryFactory();
    await repositoryFactory.create();
    const repo = await repositoryFactory.cloneRepository();

    await repo.commitChange(
      'packages/pkg-1/package.json',
      JSON.stringify({
        name: 'pkg-1',
        version: '1.0.0',
      })
    );

    await repo.commitChange(
      'packages/pkg-2/package.json',
      JSON.stringify({
        name: 'pkg-2',
        version: '1.0.0',
      })
    );

    await repo.commitChange(
      'packages/pkg-3/package.json',
      JSON.stringify({
        name: 'pkg-3',
        version: '1.0.0',
      })
    );

    await repo.commitChange(
      'unrelated/pkg-4/package.json',
      JSON.stringify({
        name: 'pkg-4',
        version: '1.0.0',
      })
    );

    writeChangeFiles(
      {
        'pkg-1': {
          type: 'minor',
          comment: 'test',
          date: new Date('2019-01-01'),
          email: 'test@test.com',
          packageName: 'pkg-1',
          dependentChangeType: 'patch',
        },
      },
      repo.rootPath
    );

    git(['push', 'origin', 'master'], { cwd: repo.rootPath });

    await bump({ path: repo.rootPath, groups: [{ include: 'packages/*', name: 'testgroup' }] } as BeachballOptions);

    const packageInfos = getPackageInfos(repo.rootPath);

    expect(packageInfos['pkg-1'].version).toBe('1.1.0');
    expect(packageInfos['pkg-2'].version).toBe('1.1.0');
    expect(packageInfos['pkg-3'].version).toBe('1.1.0');
    expect(packageInfos['pkg-4'].version).toBe('1.0.0');

    const changeFiles = getChangeFiles(repo.rootPath);
    expect(changeFiles.length).toBe(0);
  });

  it('bumps all grouped AND dependent packages', async () => {
    repositoryFactory = new RepositoryFactory();
    await repositoryFactory.create();
    const repo = await repositoryFactory.cloneRepository();

    await repo.commitChange(
      'packages/grp/1/package.json',
      JSON.stringify({
        name: 'pkg-1',
        version: '1.0.0',
      })
    );

    await repo.commitChange(
      'packages/grp/2/package.json',
      JSON.stringify({
        name: 'pkg-2',
        version: '1.0.0',
      })
    );

    await repo.commitChange(
      'packages/grp/3/package.json',
      JSON.stringify({
        name: 'pkg-3',
        version: '1.0.0',
        dependencies: {
          commonlib: '1.0.0',
        },
      })
    );

    await repo.commitChange(
      'packages/commonlib/package.json',
      JSON.stringify({
        name: 'commonlib',
        version: '1.0.0',
      })
    );

    await repo.commitChange(
      'packages/app/package.json',
      JSON.stringify({
        name: 'app',
        version: '1.0.0',
        dependencies: {
          'pkg-1': '1.0.0',
        },
      })
    );

    await repo.commitChange(
      'packages/unrelated/package.json',
      JSON.stringify({
        name: 'unrelated',
        version: '1.0.0',
      })
    );

    writeChangeFiles(
      {
        commonlib: {
          type: 'minor',
          comment: 'test',
          date: new Date('2019-01-01'),
          email: 'test@test.com',
          packageName: 'commonlib',
          dependentChangeType: 'minor',
        },
      },
      repo.rootPath
    );

    git(['push', 'origin', 'master'], { cwd: repo.rootPath });

    await bump({
      path: repo.rootPath,
      groups: [{ include: 'packages/grp/*', name: 'grp' }],
      bumpDeps: true,
    } as BeachballOptions);

    const packageInfos = getPackageInfos(repo.rootPath);

    expect(packageInfos['pkg-1'].version).toBe('1.1.0');
    expect(packageInfos['pkg-2'].version).toBe('1.1.0');
    expect(packageInfos['pkg-3'].version).toBe('1.1.0');
    expect(packageInfos['commonlib'].version).toBe('1.1.0');
    expect(packageInfos['app'].version).toBe('1.1.0');
    expect(packageInfos['unrelated'].version).toBe('1.0.0');

    const changeFiles = getChangeFiles(repo.rootPath);
    expect(changeFiles.length).toBe(0);
  });

  it('should not bump out-of-scope package even if package has change', async () => {
    repositoryFactory = new MonoRepoFactory();
    await repositoryFactory.create();
    const repo = await repositoryFactory.cloneRepository();

    writeChangeFiles(
      {
        foo: {
          type: 'minor',
          comment: 'test',
          date: new Date('2019-01-01'),
          email: 'test@test.com',
          packageName: 'foo',
          dependentChangeType: 'patch',
        },
      },
      repo.rootPath
    );

    git(['push', 'origin', 'master'], { cwd: repo.rootPath });

    await bump({ path: repo.rootPath, bumpDeps: true, scope: ['!packages/foo'] } as BeachballOptions);

    const packageInfos = getPackageInfos(repo.rootPath);
    expect(packageInfos['foo'].version).toBe('1.0.0');
    expect(packageInfos['bar'].version).toBe('1.3.4');

    const changeFiles = getChangeFiles(repo.rootPath);
    expect(changeFiles.length).toBe(1);
  });

  it('should not bump out-of-scope package even if dependency of the package has change', async () => {
    repositoryFactory = new MonoRepoFactory();
    await repositoryFactory.create();
    const repo = await repositoryFactory.cloneRepository();

    writeChangeFiles(
      {
        bar: {
          type: 'patch',
          comment: 'test',
          date: new Date('2019-01-01'),
          email: 'test@test.com',
          packageName: 'bar',
          dependentChangeType: 'patch',
        },
      },
      repo.rootPath
    );

    git(['push', 'origin', 'master'], { cwd: repo.rootPath });

    await bump({ path: repo.rootPath, bumpDeps: true, scope: ['!packages/foo'] } as BeachballOptions);

    const packageInfos = getPackageInfos(repo.rootPath);
    expect(packageInfos['foo'].version).toBe('1.0.0');
    expect(packageInfos['bar'].version).toBe('1.3.5');
    expect(packageInfos['foo'].dependencies?.bar).toBe('^1.3.5');

    const changeFiles = getChangeFiles(repo.rootPath);
    expect(changeFiles.length).toBe(0);
  });

  it('bumps all packages and keeps change files with `keep-change-files` flag', async () => {
    repositoryFactory = new RepositoryFactory();
    await repositoryFactory.create();
    const repo = await repositoryFactory.cloneRepository();

    await repo.commitChange(
      'packages/pkg-1/package.json',
      JSON.stringify({
        name: 'pkg-1',
        version: '1.0.0',
      })
    );

    await repo.commitChange(
      'packages/pkg-2/package.json',
      JSON.stringify({
        name: 'pkg-2',
        version: '1.0.0',
        dependencies: {
          'pkg-1': '1.0.0',
        },
      })
    );

    await repo.commitChange(
      'packages/pkg-3/package.json',
      JSON.stringify({
        name: 'pkg-3',
        version: '1.0.0',
        devDependencies: {
          'pkg-2': '1.0.0',
        },
      })
    );

    await repo.commitChange(
      'packages/pkg-4/package.json',
      JSON.stringify({
        name: 'pkg-4',
        version: '1.0.0',
        peerDependencies: {
          'pkg-3': '1.0.0',
        },
      })
    );

    await repo.commitChange(
      'package.json',
      JSON.stringify({
        name: 'foo-repo',
        version: '1.0.0',
        private: true,
      })
    );

    writeChangeFiles(
      {
        'pkg-1': {
          type: 'minor',
          comment: 'test',
          date: new Date('2019-01-01'),
          email: 'test@test.com',
          packageName: 'pkg-1',
          dependentChangeType: 'patch',
        },
      },
      repo.rootPath
    );

    git(['push', 'origin', 'master'], { cwd: repo.rootPath });

    await bump({ path: repo.rootPath, bumpDeps: false, keepChangeFiles: true } as BeachballOptions);

    const packageInfos = getPackageInfos(repo.rootPath);

    expect(packageInfos['pkg-1'].version).toBe('1.1.0');
    expect(packageInfos['pkg-2'].version).toBe('1.0.0');
    expect(packageInfos['pkg-3'].version).toBe('1.0.0');

    expect(packageInfos['pkg-2'].dependencies!['pkg-1']).toBe('1.1.0');
    expect(packageInfos['pkg-3'].devDependencies!['pkg-2']).toBe('1.0.0');
    expect(packageInfos['pkg-4'].peerDependencies!['pkg-3']).toBe('1.0.0');

    const changeFiles = getChangeFiles(repo.rootPath);
    expect(changeFiles.length).toBe(1);
  });
});
