import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { initMockLogs } from '@microsoft/beachball-test-utilities';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { getPackageInfo } from 'workspace-tools';
import { generateChangeFiles, getChangeFiles, readSingleChangeFile } from '../../__fixtures__/changeFiles';
import { defaultBranchName, defaultRemoteBranchName } from '../../__fixtures__/gitDefaults';
import { RepositoryFactory } from '../../__fixtures__/repositoryFactory';
import { bumpInMemory } from '../../bump/bumpInMemory';
import { createCommandContext } from '../../monorepo/createCommandContext';
import { getOptions as _getOptions } from '../../options/getOptions';
import { bumpAndPush } from '../../publish/bumpAndPush';
import { createPublishBranch } from '../../publish/createPublishBranch';
import type { RepoOptions } from '../../types/BeachballOptions';

describe('bumpAndPush (functional)', () => {
  let repositoryFactory: RepositoryFactory | undefined;

  initMockLogs();

  async function getOptions(cwd: string, repoOptions?: Partial<RepoOptions>) {
    return _getOptions({
      cwd,
      argv: ['node', 'beachball', 'publish', '--yes'],
      env: {},
      testRepoOptions: {
        branch: defaultRemoteBranchName,
        registry: 'http://localhost:99999/',
        message: 'apply package updates',
        publish: false,
        bumpDeps: false,
        tag: 'latest',
        access: 'public',
        ...repoOptions,
      },
    });
  }

  afterEach(() => {
    repositoryFactory?.cleanUp();
    repositoryFactory = undefined;
  });

  it('updates existing custom tags', async () => {
    repositoryFactory = new RepositoryFactory('single');
    const repo = repositoryFactory.cloneRepository();
    const originalHash = repo.getCurrentHash();
    for (const tag of ['foo_v1.0.0', 'foo_v1', 'release/foo', 'beta']) {
      repo.git(['tag', '-a', tag, '-m', tag]);
    }
    repo.git(['push', 'origin', '--tags']);

    const parsedOptions = await getOptions(repo.rootPath, {
      fetch: false,
      tag: 'beta', // no tag is created for this
      getGitTag: (_pkg, defaultTag) => [defaultTag, 'foo_v1', 'release/foo'],
    });
    const { options } = parsedOptions;
    generateChangeFiles(['foo'], options);
    repo.push();

    const publishBranch = createPublishBranch(repo.rootPath);
    const bumpInfo = bumpInMemory(options, createCommandContext(parsedOptions));

    await bumpAndPush(bumpInfo, publishBranch, options);

    const newRepo = repositoryFactory.cloneRepository();
    const publishedHash = newRepo.getCurrentHash();
    expect(repo.getRemoteRefs()).toEqual({
      branches: { [defaultBranchName]: publishedHash },
      tags: {
        beta: originalHash,
        'foo_v1.0.0': originalHash,
        foo_v1: publishedHash,
        'foo_v1.1.0': publishedHash,
        'release/foo': publishedHash,
      },
    });
    expect(getPackageInfo(newRepo.rootPath)?.version).toBe('1.1.0');
  });

  it('can handle a merge when there are change files present', async () => {
    repositoryFactory = new RepositoryFactory('single');
    // 1. clone a new repo1, write a change file in repo1
    const repo1 = repositoryFactory.cloneRepository();
    const parsedOptions = await getOptions(repo1.rootPath);
    const { options } = parsedOptions;
    generateChangeFiles(['foo'], options);
    repo1.push();

    // 2. simulate the start of a publish from repo1
    const publishBranch = createPublishBranch(repo1.rootPath);
    const bumpInfo = bumpInMemory(options, createCommandContext(parsedOptions));

    // 3. Meanwhile, in repo2, also create a new change file
    const repo2 = repositoryFactory.cloneRepository();
    generateChangeFiles(['foo2'], { ...options, path: repo2.rootPath });
    repo2.push();

    // 4. Pretend to continue on with repo1's publish
    await bumpAndPush(bumpInfo, publishBranch, options);

    // 5. In a brand new cloned repo, make assertions
    const newRepo = repositoryFactory.cloneRepository();
    const changeFiles = getChangeFiles({ ...options, path: newRepo.rootPath });
    expect(changeFiles).toHaveLength(1);
    const changeFileContent = readSingleChangeFile(changeFiles[0]);
    expect(changeFileContent.packageName).toBe('foo2');
  });

  it('calls precommit hook once before committing changes', async () => {
    repositoryFactory = new RepositoryFactory('monorepo');
    const repo = repositoryFactory.cloneRepository();

    const parsedOptions = await getOptions(repo.rootPath, {
      fetch: false,
      hooks: {
        precommit: jest.fn(async (cwd: string) => {
          const packageInfo = getPackageInfo(repo.pathTo('packages/foo'));
          expect(packageInfo?.version).toBe('1.1.0');
          await fsPromises.writeFile(path.join(cwd, 'foo.txt'), 'foo');
        }),
      },
    });
    const { options } = parsedOptions;
    generateChangeFiles(['foo', 'bar'], options);
    repo.push();

    const publishBranch = createPublishBranch(repo.rootPath);
    const bumpInfo = bumpInMemory(options, createCommandContext(parsedOptions));

    await bumpAndPush(bumpInfo, publishBranch, options);

    // precommit was called (once for whole repo, not per package)
    expect(options.hooks?.precommit).toHaveBeenCalledTimes(1);

    // changes from publish process were committed
    const newRepo = repositoryFactory.cloneRepository();
    expect(await fsPromises.readFile(newRepo.pathTo('foo.txt'), 'utf8')).toBe('foo');
  });
});
