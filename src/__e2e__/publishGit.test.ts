import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs-extra';
import { defaultRemoteBranchName } from '../__fixtures__/gitDefaults';
import { generateChangeFiles, getChangeFiles } from '../__fixtures__/changeFiles';
import { initMockLogs } from '../__fixtures__/mockLogs';
import type { Repository } from '../__fixtures__/repository';
import { RepositoryFactory } from '../__fixtures__/repositoryFactory';
import { bumpAndPush } from '../publish/bumpAndPush';
import { publish } from '../commands/publish';
import { gatherBumpInfo } from '../bump/gatherBumpInfo';
import type { BeachballOptions } from '../types/BeachballOptions';
import type { ChangeFileInfo } from '../types/ChangeInfo';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import { getDefaultOptions } from '../options/getDefaultOptions';
import type { PackageJson } from '../types/PackageInfo';

describe('publish command (git)', () => {
  let repositoryFactory: RepositoryFactory;
  let repo: Repository | undefined;

  initMockLogs();

  function getOptions(overrides?: Partial<BeachballOptions>): BeachballOptions {
    return {
      ...getDefaultOptions(),
      package: 'foo',
      branch: defaultRemoteBranchName,
      path: repo?.rootPath || '',
      registry: 'http://localhost:99999/',
      command: 'publish',
      message: 'apply package updates',
      publish: false,
      bumpDeps: false,
      tag: 'latest',
      yes: true,
      access: 'public',
      ...overrides,
    };
  }

  beforeEach(() => {
    repositoryFactory = new RepositoryFactory('single');
  });

  afterEach(() => {
    repositoryFactory.cleanUp();
    repo = undefined;
  });

  it('can perform a successful git push', async () => {
    repo = repositoryFactory.cloneRepository();

    const options = getOptions();
    generateChangeFiles(['foo'], options);
    repo.push();

    await publish(options);

    const newRepo = repositoryFactory.cloneRepository();

    const packageJson = fs.readJSONSync(newRepo.pathTo('package.json')) as PackageJson;

    expect(packageJson.version).toBe('1.1.0');
  });

  it('can handle a merge when there are change files present', async () => {
    // 1. clone a new repo1, write a change file in repo1
    const repo1 = repositoryFactory.cloneRepository();
    const options1 = getOptions({ path: repo1.rootPath });
    generateChangeFiles(['foo'], options1);
    repo1.push();

    // 2. simulate the start of a publish from repo1
    const publishBranch = 'publish_test';
    repo1.checkout('-b', publishBranch);

    const bumpInfo = gatherBumpInfo(options1, getPackageInfos(repo1.rootPath));

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
    const changeFileContent = fs.readJSONSync(changeFiles[0]) as ChangeFileInfo;
    expect(changeFileContent.packageName).toBe('foo2');
  });
});
