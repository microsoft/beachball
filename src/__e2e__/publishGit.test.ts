import { describe, expect, it, afterEach, jest } from '@jest/globals';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { defaultBranchName, defaultRemoteBranchName } from '../__fixtures__/gitDefaults';
import { generateChangeFiles, getChangeFiles } from '../__fixtures__/changeFiles';
import { initMockLogs } from '../__fixtures__/mockLogs';
import type { Repository } from '../__fixtures__/repository';
import { RepositoryFactory } from '../__fixtures__/repositoryFactory';
import { bumpAndPush } from '../publish/bumpAndPush';
import { publish } from '../commands/publish';
import { bumpInMemory } from '../bump/bumpInMemory';
import type { ChangeFileInfo } from '../types/ChangeInfo';
import type { PackageJson } from '../types/PackageInfo';
import { getParsedOptions } from '../options/getOptions';
import { readJson } from '../object/readJson';
import { createCommandContext } from '../monorepo/createCommandContext';
import type { RepoOptions } from '../types/BeachballOptions';
import { addGitObserver, clearGitObservers } from 'workspace-tools';

describe('publish command (git)', () => {
  let repositoryFactory: RepositoryFactory | undefined;
  let repo: Repository | undefined;

  initMockLogs();

  function getOptions(repoOptions?: Partial<RepoOptions>) {
    const cwd = repoOptions?.path || repo!.rootPath;
    const parsedOptions = getParsedOptions({
      cwd,
      argv: ['node', 'beachball', 'publish', '--yes'],
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
    return { options: parsedOptions.options, parsedOptions };
  }

  afterEach(() => {
    clearGitObservers();
    repositoryFactory?.cleanUp();
    repositoryFactory = undefined;
    repo = undefined;
  });

  it('can perform a successful git push', async () => {
    repositoryFactory = new RepositoryFactory('single');
    repo = repositoryFactory.cloneRepository();

    const { options, parsedOptions } = getOptions();
    generateChangeFiles(['foo'], options);
    repo.push();

    await publish(options, createCommandContext(parsedOptions));

    const newRepo = repositoryFactory.cloneRepository();

    const packageJson = readJson<PackageJson>(newRepo.pathTo('package.json'));

    expect(packageJson.version).toBe('1.1.0');
  });

  it('can handle a merge when there are change files present', async () => {
    repositoryFactory = new RepositoryFactory('single');
    // 1. clone a new repo1, write a change file in repo1
    const repo1 = repositoryFactory.cloneRepository();
    const { options: options1, parsedOptions: parsedOptions1 } = getOptions({ path: repo1.rootPath });
    generateChangeFiles(['foo'], options1);
    repo1.push();

    // 2. simulate the start of a publish from repo1
    const publishBranch = 'publish_test';
    repo1.checkout('-b', publishBranch);

    const bumpInfo = bumpInMemory(options1, createCommandContext(parsedOptions1));

    // 3. Meanwhile, in repo2, also create a new change file
    const repo2 = repositoryFactory.cloneRepository();
    generateChangeFiles(['foo2'], { ...options1, path: repo2.rootPath });
    repo2.push();

    // 4. Pretend to continue on with repo1's publish
    await bumpAndPush(bumpInfo, publishBranch, options1);

    // 5. In a brand new cloned repo, make assertions
    const newRepo = repositoryFactory.cloneRepository();
    const changeFiles = getChangeFiles({ ...options1, path: newRepo.rootPath });
    expect(changeFiles).toHaveLength(1);
    const changeFileContent = readJson<ChangeFileInfo>(changeFiles[0]);
    expect(changeFileContent.packageName).toBe('foo2');
  });

  it('calls precommit hook once before committing changes', async () => {
    repositoryFactory = new RepositoryFactory('monorepo');
    repo = repositoryFactory.cloneRepository();

    const { options, parsedOptions } = getOptions({
      fetch: false,
      hooks: {
        precommit: jest.fn(async (cwd: string) => {
          expect(readJson<PackageJson>(path.join(cwd, 'packages/foo/package.json')).version).toBe('1.1.0');
          const filePath = path.join(cwd, 'foo.txt');
          await fsPromises.writeFile(filePath, 'foo');
        }),
      },
    });

    generateChangeFiles(['foo', 'bar'], options);
    repo.push();

    await publish(options, createCommandContext(parsedOptions));

    // precommit was called (once for whole repo, not per package)
    expect(options.hooks?.precommit).toHaveBeenCalledTimes(1);
    // but changes from publish process were reverted locally
    const txtPath = repo.pathTo('foo.txt');
    expect(fs.existsSync(txtPath)).toBe(false);

    repo.checkout(defaultBranchName);
    repo.pull();

    // changes from publish process were committed
    expect(fs.existsSync(txtPath)).toBe(true);
  });

  it('specifies fetch depth when depth param is defined', async () => {
    repositoryFactory = new RepositoryFactory('single');
    repo = repositoryFactory.cloneRepository();

    const { options, parsedOptions } = getOptions({
      depth: 10,
    });

    generateChangeFiles(['foo'], options);
    repo.push();

    const gitObserver = jest.fn((args: string[]) => {
      if (args[0] === 'fetch') {
        expect(args).toContain('--depth=10');
      }
    });
    addGitObserver(gitObserver);

    await publish(options, createCommandContext(parsedOptions));
    expect(gitObserver).toHaveBeenCalled();
  });
});
