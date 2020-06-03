import { Registry } from '../fixtures/registry';
import { npm } from '../packageManager/npm';
import { writeChangeFiles } from '../changefile/writeChangeFiles';
import { git } from '../git';
import { publish } from '../commands/publish';
import { RepositoryFactory } from '../fixtures/repository';

describe('publish command (registry)', () => {
  let registry: Registry;
  let repositoryFactory: RepositoryFactory | undefined;
  let spy: jest.SpyInstance | undefined;

  beforeAll(() => {
    registry = new Registry();
    jest.setTimeout(30000);
  });

  afterAll(() => {
    registry.stop();
  });

  beforeEach(async () => {
    await registry.reset();
  });

  afterEach(async () => {
    if (repositoryFactory) {
      await repositoryFactory.cleanUp();
      repositoryFactory = undefined;
    }
    if (spy) {
      spy.mockRestore();
      spy = undefined;
    }
  });

  it('will perform retries', async () => {
    registry.stop();

    repositoryFactory = new RepositoryFactory();
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

    spy = jest.spyOn(console, 'log').mockImplementation();

    const publishPromise = publish({
      branch: 'origin/master',
      command: 'publish',
      message: 'apply package updates',
      path: repo.rootPath,
      publish: true,
      bumpDeps: false,
      push: false,
      registry: 'httppppp://somethingwrong',
      gitTags: false,
      tag: 'latest',
      token: '',
      yes: true,
      new: false,
      access: 'public',
      package: 'foo',
      changehint: 'Run "beachball change" to create a change file',
      type: null,
      fetch: true,
      disallowedChangeTypes: null,
      defaultNpmTag: 'latest',
      retries: 3,
      timeout: 100,
    });

    await expect(publishPromise).rejects.toThrow();
    expect(spy).toHaveBeenCalledWith('\nRetrying... (3/3)');

    spy.mockRestore();

    await registry.start();
  });

  it('can perform a successful npm publish', async () => {
    repositoryFactory = new RepositoryFactory();
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

    await publish({
      branch: 'origin/master',
      command: 'publish',
      message: 'apply package updates',
      path: repo.rootPath,
      publish: true,
      bumpDeps: false,
      push: false,
      registry: registry.getUrl(),
      gitTags: false,
      tag: 'latest',
      token: '',
      yes: true,
      new: false,
      access: 'public',
      package: 'foo',
      changehint: 'Run "beachball change" to create a change file',
      type: null,
      fetch: true,
      disallowedChangeTypes: null,
      defaultNpmTag: 'latest',
      retries: 3,
    });

    const showResult = npm(['--registry', registry.getUrl(), 'show', 'foo', '--json']);

    expect(showResult.success).toBeTruthy();

    const show = JSON.parse(showResult.stdout);
    expect(show.name).toEqual('foo');
    expect(show.versions.length).toEqual(1);
  });

  it('can perform a successful npm publish even with private packages', async () => {
    repositoryFactory = new RepositoryFactory();
    await repositoryFactory.create();
    const repo = await repositoryFactory.cloneRepository();

    await repo.commitChange(
      'packages/foopkg/package.json',
      JSON.stringify({
        name: 'foopkg',
        version: '1.0.0',
        private: true,
      })
    );

    await repo.commitChange(
      'packages/publicpkg/package.json',
      JSON.stringify({
        name: 'publicpkg',
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
        foopkg: {
          type: 'minor',
          comment: 'test',
          date: new Date('2019-01-01'),
          email: 'test@test.com',
          packageName: 'foopkg',
          dependentChangeType: 'patch',
        },
      },
      repo.rootPath
    );

    git(['push', 'origin', 'master'], { cwd: repo.rootPath });

    await publish({
      branch: 'origin/master',
      command: 'publish',
      message: 'apply package updates',
      path: repo.rootPath,
      publish: true,
      bumpDeps: false,
      push: false,
      registry: registry.getUrl(),
      gitTags: false,
      tag: 'latest',
      token: '',
      yes: true,
      new: false,
      access: 'public',
      package: 'foopkg',
      changehint: 'Run "beachball change" to create a change file',
      type: null,
      fetch: true,
      disallowedChangeTypes: null,
      defaultNpmTag: 'latest',
      retries: 3,
    });

    const showResult = npm(['--registry', registry.getUrl(), 'show', 'foopkg', '--json']);

    expect(showResult.success).toBeFalsy();
  });

  it('can perform a successful npm publish when multiple packages changed at same time', async () => {
    repositoryFactory = new RepositoryFactory();
    await repositoryFactory.create();
    const repo = await repositoryFactory.cloneRepository();

    await repo.commitChange(
      'packages/foopkg/package.json',
      JSON.stringify({
        name: 'foopkg',
        version: '1.0.0',
        dependencies: {
          barpkg: '^1.0.0',
        },
      })
    );

    await repo.commitChange(
      'packages/barpkg/package.json',
      JSON.stringify({
        name: 'barpkg',
        version: '1.0.0',
      })
    );

    writeChangeFiles(
      {
        foopkg: {
          type: 'minor',
          comment: 'test',
          date: new Date('2019-01-01'),
          email: 'test@test.com',
          packageName: 'foopkg',
          dependentChangeType: 'patch',
        },
        barpkg: {
          type: 'minor',
          comment: 'test',
          date: new Date('2019-01-01'),
          email: 'test@test.com',
          packageName: 'barpkg',
          dependentChangeType: 'patch',
        },
      },
      repo.rootPath
    );

    git(['push', 'origin', 'master'], { cwd: repo.rootPath });

    await publish({
      branch: 'origin/master',
      command: 'publish',
      message: 'apply package updates',
      path: repo.rootPath,
      publish: true,
      bumpDeps: false,
      push: false,
      registry: registry.getUrl(),
      gitTags: false,
      tag: 'latest',
      token: '',
      yes: true,
      new: false,
      access: 'public',
      package: 'foopkg',
      changehint: 'Run "beachball change" to create a change file',
      type: null,
      fetch: true,
      disallowedChangeTypes: null,
      defaultNpmTag: 'latest',
      retries: 3,
    });

    const showResultFoo = npm(['--registry', registry.getUrl(), 'show', 'foopkg', '--json']);
    expect(showResultFoo.success).toBeTruthy();
    const showFoo = JSON.parse(showResultFoo.stdout);
    expect(showFoo['dist-tags'].latest).toEqual('1.1.0');

    const showResultBar = npm(['--registry', registry.getUrl(), 'show', 'barpkg', '--json']);
    expect(showResultBar.success).toBeTruthy();
    const showBar = JSON.parse(showResultFoo.stdout);
    expect(showBar['dist-tags'].latest).toEqual('1.1.0');
  });

  it('can perform a successful npm publish even with a non-existent package listed in the change file', async () => {
    repositoryFactory = new RepositoryFactory();
    await repositoryFactory.create();
    const repo = await repositoryFactory.cloneRepository();

    await repo.commitChange(
      'packages/foopkg/package.json',
      JSON.stringify({
        name: 'foopkg',
        version: '1.0.0',
      })
    );

    await repo.commitChange(
      'packages/publicpkg/package.json',
      JSON.stringify({
        name: 'publicpkg',
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
        badname: {
          type: 'minor',
          comment: 'test',
          date: new Date('2019-01-01'),
          email: 'test@test.com',
          packageName: 'badname',
          dependentChangeType: 'patch',
        },
      },
      repo.rootPath
    );

    git(['push', 'origin', 'master'], { cwd: repo.rootPath });

    await publish({
      branch: 'origin/master',
      command: 'publish',
      message: 'apply package updates',
      path: repo.rootPath,
      publish: true,
      bumpDeps: false,
      push: false,
      registry: registry.getUrl(),
      gitTags: false,
      tag: 'latest',
      token: '',
      yes: true,
      new: false,
      access: 'public',
      package: 'foopkg',
      changehint: 'Run "beachball change" to create a change file',
      type: null,
      fetch: true,
      disallowedChangeTypes: null,
      defaultNpmTag: 'latest',
      retries: 3,
    });

    const showResult = npm(['--registry', registry.getUrl(), 'show', 'badname', '--json']);

    expect(showResult.success).toBeFalsy();
  });
});
