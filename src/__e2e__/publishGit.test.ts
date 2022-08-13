import fs from 'fs-extra';
import { defaultRemoteBranchName } from '../__fixtures__/gitDefaults';
import { generateChangeFiles, getChangeFiles } from '../__fixtures__/changeFiles';
import { initMockLogs } from '../__fixtures__/mockLogs';
import { Repository } from '../__fixtures__/repository';
import { RepositoryFactory } from '../__fixtures__/repositoryFactory';
import { bumpAndPush } from '../publish/bumpAndPush';
import { publish } from '../commands/publish';
import { gatherBumpInfo } from '../bump/gatherBumpInfo';
import { BeachballOptions } from '../types/BeachballOptions';
import { ChangeFileInfo } from '../types/ChangeInfo';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import { getDefaultOptions } from '../options/getDefaultOptions';

function getOptions(repo: Repository, overrides?: Partial<BeachballOptions>): BeachballOptions {
  return {
    ...getDefaultOptions(),
    package: 'foo',
    branch: defaultRemoteBranchName,
    path: repo.rootPath,
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

describe('publish command (git)', () => {
  let repositoryFactory: RepositoryFactory;

  initMockLogs();

  beforeAll(() => {
    jest.setTimeout(30000);
  });

  beforeEach(() => {
    repositoryFactory = new RepositoryFactory('single');
  });

  afterEach(() => {
    repositoryFactory.cleanUp();
  });

  it('can perform a successful git push', async () => {
    const repo = repositoryFactory.cloneRepository();

    generateChangeFiles(['foo'], repo.rootPath);

    repo.push();

    await publish(getOptions(repo));

    const newRepo = repositoryFactory.cloneRepository();

    const packageJson = fs.readJSONSync(newRepo.pathTo('package.json'));

    expect(packageJson.version).toBe('1.1.0');
  });

  it('can handle a merge when there are change files present', async () => {
    // 1. clone a new repo1, write a change file in repo1
    const repo1 = repositoryFactory.cloneRepository();
    generateChangeFiles(['foo'], repo1.rootPath);
    repo1.push();

    // 2. simulate the start of a publish from repo1
    const publishBranch = 'publish_test';
    repo1.checkoutNewBranch(publishBranch);

    const options: BeachballOptions = getOptions(repo1);

    const bumpInfo = gatherBumpInfo(options, getPackageInfos(repo1.rootPath));

    // 3. Meanwhile, in repo2, also create a new change file
    const repo2 = repositoryFactory.cloneRepository();
    generateChangeFiles(['foo2'], repo2.rootPath);
    repo2.push();

    // 4. Pretend to continue on with repo1's publish
    await bumpAndPush(bumpInfo, publishBranch, options);

    // 5. In a brand new cloned repo, make assertions
    const newRepo = repositoryFactory.cloneRepository();
    const changeFiles = getChangeFiles(newRepo.rootPath);
    expect(changeFiles).toHaveLength(1);
    const changeFileContent: ChangeFileInfo = fs.readJSONSync(changeFiles[0]);
    expect(changeFileContent.packageName).toBe('foo2');
  });
});
