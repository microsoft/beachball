import { defaultRemoteBranchName } from '../__fixtures__/gitDefaults';
import { generateChangeFiles } from '../__fixtures__/changeFiles';
import { initMockLogs } from '../__fixtures__/mockLogs';
import { npmShow } from '../__fixtures__/npmShow';
import { Registry } from '../__fixtures__/registry';
import { Repository } from '../__fixtures__/repository';
import { RepositoryFactory } from '../__fixtures__/repositoryFactory';
import { publish } from '../commands/publish';
import { getDefaultOptions } from '../options/getDefaultOptions';
import { BeachballOptions } from '../types/BeachballOptions';

describe('publish command (registry)', () => {
  let registry: Registry;
  let repositoryFactory: RepositoryFactory | undefined;

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
    repositoryFactory = new RepositoryFactory('single');
    const repo = repositoryFactory.cloneRepository();

    generateChangeFiles(['foo'], repo.rootPath);

    repo.push();

    await publish(getOptions(repo, { package: 'foo' }));

    const show = npmShow(registry, 'foo')!;
    expect(show.name).toEqual('foo');
    expect(show.versions).toHaveLength(1);
  });

  it('can perform a successful npm publish even with private packages', async () => {
    repositoryFactory = new RepositoryFactory({
      folders: {
        packages: {
          foopkg: { version: '1.0.0', private: true },
          publicpkg: { version: '1.0.0' },
        },
      },
    });
    const repo = repositoryFactory.cloneRepository();

    generateChangeFiles(['foopkg'], repo.rootPath);

    repo.push();

    await publish(getOptions(repo, { package: 'foopkg' }));

    npmShow(registry, 'foopkg', true /*shouldFail*/);
  });

  it('can perform a successful npm publish when multiple packages changed at same time', async () => {
    repositoryFactory = new RepositoryFactory({
      folders: {
        packages: {
          foopkg: { version: '1.0.0', dependencies: { barpkg: '^1.0.0' } },
          barpkg: { version: '1.0.0' },
        },
      },
    });
    const repo = repositoryFactory.cloneRepository();

    generateChangeFiles(['foopkg', 'barpkg'], repo.rootPath);

    repo.push();

    await publish(getOptions(repo, { package: 'foopkg' }));

    const showFoo = npmShow(registry, 'foopkg')!;
    expect(showFoo['dist-tags'].latest).toEqual('1.1.0');

    const showBar = npmShow(registry, 'barpkg')!;
    expect(showBar['dist-tags'].latest).toEqual('1.1.0');
  });

  it('can perform a successful npm publish even with a non-existent package listed in the change file', async () => {
    repositoryFactory = new RepositoryFactory({
      folders: {
        packages: {
          foopkg: { version: '1.0.0' },
          barpkg: { version: '1.0.0' },
        },
      },
    });
    const repo = repositoryFactory.cloneRepository();

    generateChangeFiles(['badname'], repo.rootPath);

    repo.push();

    await publish(getOptions(repo, { package: 'foopkg' }));

    npmShow(registry, 'badname', true /*shouldFail*/);
  });

  it('should exit publishing early if only invalid change files exist', async () => {
    repositoryFactory = new RepositoryFactory('monorepo');
    const repo = repositoryFactory.cloneRepository();

    repo.updateJsonFile('packages/bar/package.json', { private: true });

    generateChangeFiles(['bar', 'fake'], repo.rootPath);

    repo.push();

    await publish(getOptions(repo, { package: 'foopkg' }));

    expect(logs.mocks.log).toHaveBeenCalledWith('Nothing to bump, skipping publish!');
    expect(logs.mocks.warn).toHaveBeenCalledWith(expect.stringContaining('Change detected for private package bar'));
    expect(logs.mocks.warn).toHaveBeenCalledWith(
      expect.stringContaining('Change detected for nonexistent package fake')
    );

    npmShow(registry, 'fake', true /*shouldFail*/);
  });

  it('will perform retries', async () => {
    registry.stop();

    // hide the errors for this test--it's supposed to have errors, and showing them is misleading
    logs.init(false);

    repositoryFactory = new RepositoryFactory('single');
    const repo = repositoryFactory.cloneRepository();

    generateChangeFiles(['foo'], repo.rootPath);

    repo.push();

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
  });
});
