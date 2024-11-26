import { describe, expect, it, afterEach, jest } from '@jest/globals';
import { defaultRemoteBranchName } from '../__fixtures__/gitDefaults';
import { generateChangeFiles } from '../__fixtures__/changeFiles';
import { initMockLogs } from '../__fixtures__/mockLogs';
import { npmShow } from '../__fixtures__/npmShow';
import type { Repository } from '../__fixtures__/repository';
import { RepositoryFactory } from '../__fixtures__/repositoryFactory';
import { publish } from '../commands/publish';
import { getDefaultOptions } from '../options/getDefaultOptions';
import type { BeachballOptions } from '../types/BeachballOptions';
import { initNpmMock } from '../__fixtures__/mockNpm';
import { mockProcessExit } from '../__fixtures__/mockProcessExit';

// Spawning actual npm to run commands against a fake registry is extremely slow, so mock it for
// this test (packagePublish covers the more complete npm registry scenario).
//
// If an issue is found in the future that could only be caught by this test using real npm,
// a new test file with a real registry should be created to cover that specific scenario.
jest.mock('../packageManager/npm');

describe('publish command (registry)', () => {
  initNpmMock();
  mockProcessExit();

  let repositoryFactory: RepositoryFactory | undefined;
  let repo: Repository | undefined;

  // show error logs for these tests
  const logs = initMockLogs({ alsoLog: ['error'] });

  function getOptions(): BeachballOptions {
    return {
      ...getDefaultOptions(),
      branch: defaultRemoteBranchName,
      // change to ?. if a future test uses a non-standard repo
      path: repo!.rootPath,
      registry: 'fake',
      command: 'publish',
      message: 'apply package updates',
      bumpDeps: false,
      push: false,
      gitTags: false,
      tag: 'latest',
      yes: true,
      access: 'public',
    };
  }

  afterEach(() => {
    repositoryFactory?.cleanUp();
    repositoryFactory = undefined;
    repo = undefined;
  });

  it('publishes single package', async () => {
    repositoryFactory = new RepositoryFactory('single');
    repo = repositoryFactory.cloneRepository();

    const options = getOptions();
    generateChangeFiles(['foo'], options);

    repo.push();

    await publish(options);

    const publishedPackage = (await npmShow('foo'))!;
    expect(publishedPackage.name).toEqual('foo');
    expect(publishedPackage.versions).toHaveLength(1);
  });

  it('publishes in monorepo with mixed public and private packages', async () => {
    repositoryFactory = new RepositoryFactory({
      folders: {
        packages: {
          foopkg: { version: '1.0.0', private: true },
          publicpkg: { version: '1.0.0' },
        },
      },
    });
    repo = repositoryFactory.cloneRepository();

    const options = getOptions();
    generateChangeFiles(['foopkg'], options);

    repo.push();

    await publish(options);

    expect(logs.mocks.log).toHaveBeenCalledWith('Nothing to bump, skipping publish!');
    expect(logs.mocks.warn).toHaveBeenCalledWith(expect.stringContaining('Change detected for private package foopkg'));

    await npmShow('foopkg', { shouldFail: true });
  });

  it('publishes when multiple packages changed at same time', async () => {
    repositoryFactory = new RepositoryFactory({
      folders: {
        packages: {
          foopkg: { version: '1.0.0', dependencies: { barpkg: '^1.0.0' } },
          barpkg: { version: '1.0.0' },
        },
      },
    });
    repo = repositoryFactory.cloneRepository();

    const options = getOptions();
    generateChangeFiles(['foopkg', 'barpkg'], options);

    repo.push();

    await publish(options);

    const showFoo = (await npmShow('foopkg'))!;
    expect(showFoo['dist-tags'].latest).toEqual('1.1.0');

    const showBar = (await npmShow('barpkg'))!;
    expect(showBar['dist-tags'].latest).toEqual('1.1.0');
  });

  it('succeeds even with a non-existent package listed in a change file', async () => {
    repositoryFactory = new RepositoryFactory({
      folders: {
        packages: {
          foopkg: { version: '1.0.0' },
          barpkg: { version: '1.0.0' },
        },
      },
    });
    repo = repositoryFactory.cloneRepository();

    const options = getOptions();
    generateChangeFiles(['badname'], options);

    repo.push();

    await publish(options);

    expect(logs.mocks.warn).toHaveBeenCalledWith(
      expect.stringContaining('Change detected for nonexistent package badname')
    );
    expect(logs.mocks.log).toHaveBeenCalledWith('Nothing to bump, skipping publish!');

    // didn't somehow publish a package that doesn't exist
    await npmShow('badname', { shouldFail: true });
  });

  it('exits publishing early if only invalid change files exist', async () => {
    repositoryFactory = new RepositoryFactory('monorepo');
    repo = repositoryFactory.cloneRepository();

    repo.updateJsonFile('packages/bar/package.json', { private: true });

    const options = getOptions();
    generateChangeFiles(['bar', 'fake'], options);

    repo.push();

    await publish(options);

    expect(logs.mocks.log).toHaveBeenCalledWith('Nothing to bump, skipping publish!');
    expect(logs.mocks.warn).toHaveBeenCalledWith(expect.stringContaining('Change detected for private package bar'));
    expect(logs.mocks.warn).toHaveBeenCalledWith(
      expect.stringContaining('Change detected for nonexistent package fake')
    );

    await npmShow('fake', { shouldFail: true });
  });
});
