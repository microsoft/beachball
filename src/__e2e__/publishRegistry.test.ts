import { git } from 'workspace-tools';
import { defaultRemoteBranchName } from '../__fixtures__/gitDefaults';
import { generateChangeFiles } from '../__fixtures__/changeFiles';
import { initMockLogs } from '../__fixtures__/mockLogs';
import { MonoRepoFactory, packageJsonFixtures } from '../__fixtures__/monorepo';
import { Registry } from '../__fixtures__/registry';
import { Repository, RepositoryFactory } from '../__fixtures__/repository';
import { npm } from '../packageManager/npm';
import { publish } from '../commands/publish';
import { getDefaultOptions } from '../options/getDefaultOptions';
import { BeachballOptions } from '../types/BeachballOptions';

describe('publish command (registry)', () => {
  let registry: Registry;
  let repositoryFactory: RepositoryFactory | MonoRepoFactory | undefined;

  // show error logs for these tests
  const logs = initMockLogs(['error']);

  function getOptions(repo: Repository, overrides: Partial<BeachballOptions>): BeachballOptions {
    return {
      ...getDefaultOptions(),
      branch: defaultRemoteBranchName,
      path: repo.rootPath,
      registry: registry.getUrl(),
      command: 'publish',
      message: 'apply package updates',
      bumpDeps: false,
      push: false,
      gitTags: false,
      tag: 'latest',
      yes: true,
      access: 'public',
      ...overrides,
    };
  }

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

  afterEach(() => {
    if (repositoryFactory) {
      repositoryFactory.cleanUp();
      repositoryFactory = undefined;
    }
  });

  it('can perform a successful npm publish', async () => {
    repositoryFactory = new RepositoryFactory();
    repositoryFactory.create();
    const repo = repositoryFactory.cloneRepository();

    generateChangeFiles(['foo'], repo.rootPath);

    git(['push', 'origin', 'master'], { cwd: repo.rootPath });

    await publish(getOptions(repo, { package: 'foo' }));

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

    generateChangeFiles(['foopkg'], repo.rootPath);

    git(['push', 'origin', 'master'], { cwd: repo.rootPath });

    await publish(getOptions(repo, { package: 'foopkg' }));

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

    generateChangeFiles(['foopkg', 'barpkg'], repo.rootPath);

    git(['push', 'origin', 'master'], { cwd: repo.rootPath });

    await publish(getOptions(repo, { package: 'foopkg' }));

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

    generateChangeFiles(['badname'], repo.rootPath);

    git(['push', 'origin', 'master'], { cwd: repo.rootPath });

    await publish(getOptions(repo, { package: 'foopkg' }));

    const showResult = npm(['--registry', registry.getUrl(), 'show', 'badname', '--json']);

    expect(showResult.success).toBeFalsy();
  });

  it('should exit publishing early if only invalid change files exist', async () => {
    repositoryFactory = new MonoRepoFactory();
    repositoryFactory.create();
    const repo = repositoryFactory.cloneRepository();

    repo.commitChange(
      'packages/bar/package.json',
      JSON.stringify({ ...packageJsonFixtures['packages/bar'], private: true })
    );

    generateChangeFiles(['bar', 'fake'], repo.rootPath);

    git(['push', 'origin', 'master'], { cwd: repo.rootPath });

    await publish(getOptions(repo, { package: 'foopkg' }));

    expect(logs.mocks.log).toHaveBeenCalledWith('Nothing to bump, skipping publish!');
    expect(logs.mocks.warn).toHaveBeenCalledWith(expect.stringContaining('Change detected for private package bar'));
    expect(logs.mocks.warn).toHaveBeenCalledWith(
      expect.stringContaining('Change detected for nonexistent package fake')
    );

    const showResult = npm(['--registry', registry.getUrl(), 'show', 'foo', '--json']);
    expect(showResult.success).toBeFalsy();
  });

  it('will perform retries', async () => {
    registry.stop();

    // hide the errors for this test--it's supposed to have errors, and showing them is misleading
    logs.init(false);

    repositoryFactory = new RepositoryFactory();
    repositoryFactory.create();
    const repo = repositoryFactory.cloneRepository();

    generateChangeFiles(['foo'], repo.rootPath);

    git(['push', 'origin', 'master'], { cwd: repo.rootPath });

    const publishPromise = publish(
      getOptions(repo, {
        registry: 'httppppp://somethingwrong',
        package: 'foo',
        timeout: 100,
      })
    );

    await expect(publishPromise).rejects.toThrow();
    expect(
      logs.mocks.log.mock.calls.some(([arg0]) => typeof arg0 === 'string' && arg0.includes('Retrying... (3/3)'))
    ).toBeTruthy();

    await registry.start();
  });
});
