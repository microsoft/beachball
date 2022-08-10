import { git } from 'workspace-tools';
import { initMockLogs } from '../__fixtures__/mockLogs';
import { Registry } from '../__fixtures__/registry';
import { RepositoryFactory } from '../__fixtures__/repository';
import { npm } from '../packageManager/npm';
import { writeChangeFiles } from '../changefile/writeChangeFiles';
import { publish } from '../commands/publish';

describe('publish command (registry)', () => {
  let registry: Registry;
  let repositoryFactory: RepositoryFactory | undefined;

  const logs = initMockLogs();

  beforeAll(() => {
    // don't mock console.error in these tests
    logs.mocks.error.mockRestore();

    registry = new Registry();
    jest.setTimeout(30000);
  });

  afterAll(() => {
    registry.stop();
  });

  beforeEach(async () => {
    await registry.reset();
  });

  afterEach(() => {
    if (repositoryFactory) {
      repositoryFactory.cleanUp();
      repositoryFactory = undefined;
    }
  });

  it.only('can perform a successful npm publish', async () => {
    repositoryFactory = new RepositoryFactory();
    repositoryFactory.create();
    const repo = repositoryFactory.cloneRepository();

    writeChangeFiles({
      changes: [
        {
          type: 'minor',
          comment: 'test',
          email: 'test@test.com',
          packageName: 'foo',
          dependentChangeType: 'patch',
        },
      ],
      cwd: repo.rootPath,
    });

    git(['push', 'origin', 'master'], { cwd: repo.rootPath });

    await publish({
      all: false,
      authType: 'authtoken',
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
      bump: true,
      generateChangelog: true,
      dependentChangeType: null,
    });

    const showResult = npm(['--registry', registry.getUrl(), 'show', 'foo', '--json']);

    expect(showResult.success).toBeTruthy();

    const show = JSON.parse(showResult.stdout);
    expect(show.name).toEqual('foo');
    expect(show.versions.length).toEqual(1);
  });

  it('can perform a successful npm publish even with private packages', async () => {
    repositoryFactory = new RepositoryFactory();
    repositoryFactory.create();
    const repo = repositoryFactory.cloneRepository();

    repo.commitChange(
      'packages/foopkg/package.json',
      JSON.stringify({
        name: 'foopkg',
        version: '1.0.0',
        private: true,
      })
    );

    repo.commitChange(
      'packages/publicpkg/package.json',
      JSON.stringify({
        name: 'publicpkg',
        version: '1.0.0',
      })
    );

    repo.commitChange(
      'package.json',
      JSON.stringify({
        name: 'foo-repo',
        version: '1.0.0',
        private: true,
      })
    );

    writeChangeFiles({
      changes: [
        {
          type: 'minor',
          comment: 'test',
          email: 'test@test.com',
          packageName: 'foopkg',
          dependentChangeType: 'patch',
        },
      ],
      cwd: repo.rootPath,
    });

    git(['push', 'origin', 'master'], { cwd: repo.rootPath });

    await publish({
      all: false,
      authType: 'authtoken',
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
      bump: true,
      generateChangelog: true,
      dependentChangeType: null,
    });

    const showResult = npm(['--registry', registry.getUrl(), 'show', 'foopkg', '--json']);

    expect(showResult.success).toBeFalsy();
  });

  it('can perform a successful npm publish when multiple packages changed at same time', async () => {
    repositoryFactory = new RepositoryFactory();
    repositoryFactory.create();
    const repo = repositoryFactory.cloneRepository();

    repo.commitChange(
      'packages/foopkg/package.json',
      JSON.stringify({
        name: 'foopkg',
        version: '1.0.0',
        dependencies: {
          barpkg: '^1.0.0',
        },
      })
    );

    repo.commitChange(
      'packages/barpkg/package.json',
      JSON.stringify({
        name: 'barpkg',
        version: '1.0.0',
      })
    );

    writeChangeFiles({
      changes: [
        {
          type: 'minor',
          comment: 'test',
          email: 'test@test.com',
          packageName: 'foopkg',
          dependentChangeType: 'patch',
        },
        {
          type: 'minor',
          comment: 'test',
          email: 'test@test.com',
          packageName: 'barpkg',
          dependentChangeType: 'patch',
        },
      ],
      cwd: repo.rootPath,
    });

    git(['push', 'origin', 'master'], { cwd: repo.rootPath });

    await publish({
      all: false,
      authType: 'authtoken',
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
      bump: true,
      generateChangelog: true,
      dependentChangeType: null,
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
    repositoryFactory.create();
    const repo = repositoryFactory.cloneRepository();

    repo.commitChange(
      'packages/foopkg/package.json',
      JSON.stringify({
        name: 'foopkg',
        version: '1.0.0',
      })
    );

    repo.commitChange(
      'packages/publicpkg/package.json',
      JSON.stringify({
        name: 'publicpkg',
        version: '1.0.0',
      })
    );

    repo.commitChange(
      'package.json',
      JSON.stringify({
        name: 'foo-repo',
        version: '1.0.0',
        private: true,
      })
    );

    writeChangeFiles({
      changes: [
        {
          type: 'minor',
          comment: 'test',
          email: 'test@test.com',
          packageName: 'badname',
          dependentChangeType: 'patch',
        },
      ],
      cwd: repo.rootPath,
    });

    git(['push', 'origin', 'master'], { cwd: repo.rootPath });

    await publish({
      all: false,
      authType: 'authtoken',
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
      bump: true,
      generateChangelog: true,
      dependentChangeType: null,
    });

    const showResult = npm(['--registry', registry.getUrl(), 'show', 'badname', '--json']);

    expect(showResult.success).toBeFalsy();
  });

  it('will perform retries', async () => {
    registry.stop();

    repositoryFactory = new RepositoryFactory();
    repositoryFactory.create();
    const repo = repositoryFactory.cloneRepository();

    writeChangeFiles({
      changes: [
        {
          type: 'minor',
          comment: 'test',
          email: 'test@test.com',
          packageName: 'foo',
          dependentChangeType: 'patch',
        },
      ],
      cwd: repo.rootPath,
    });

    git(['push', 'origin', 'master'], { cwd: repo.rootPath });

    const publishPromise = publish({
      all: false,
      authType: 'authtoken',
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
      bump: true,
      generateChangelog: true,
      dependentChangeType: null,
    });

    await expect(publishPromise).rejects.toThrow();
    expect(logs.mocks.log).toHaveBeenCalledWith('\nRetrying... (3/3)');

    await registry.start();
  });
});
