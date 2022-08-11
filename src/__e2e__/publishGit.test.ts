import fs from 'fs-extra';
import path from 'path';
import { git, gitFailFast } from 'workspace-tools';
import { defaultRemoteBranchName } from '../__fixtures__/gitDefaults';
import { initMockLogs } from '../__fixtures__/mockLogs';
import { Repository, RepositoryFactory } from '../__fixtures__/repository';
import { bumpAndPush } from '../publish/bumpAndPush';
import { publish } from '../commands/publish';
import { writeChangeFiles } from '../changefile/writeChangeFiles';
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
    repositoryFactory = new RepositoryFactory();
    repositoryFactory.create();
  });

  afterEach(() => {
    repositoryFactory.cleanUp();
  });

  it('can perform a successful git push', async () => {
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

    await publish(getOptions(repo));

    const newRepo = repositoryFactory.cloneRepository();

    const packageJson = fs.readJSONSync(path.join(newRepo.rootPath, 'package.json'));

    expect(packageJson.version).toBe('1.1.0');
  });

  it('can handle a merge when there are change files present', async () => {
    // 1. clone a new repo1, write a change file in repo1
    const repo1 = repositoryFactory.cloneRepository();

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
      cwd: repo1.rootPath,
    });

    git(['push', 'origin', 'master'], { cwd: repo1.rootPath });

    // 2. simulate the start of a publish from repo1
    const publishBranch = 'publish_test';
    gitFailFast(['checkout', '-b', publishBranch], { cwd: repo1.rootPath });

    const options: BeachballOptions = getOptions(repo1);

    const bumpInfo = gatherBumpInfo(options, getPackageInfos(repo1.rootPath));

    // 3. Meanwhile, in repo2, also create a new change file
    const repo2 = repositoryFactory.cloneRepository();

    writeChangeFiles({
      changes: [
        {
          type: 'minor',
          comment: 'test',
          email: 'test@test.com',
          packageName: 'foo2',
          dependentChangeType: 'patch',
        },
      ],
      cwd: repo2.rootPath,
    });

    git(['push', 'origin', 'master'], { cwd: repo2.rootPath });

    // 4. Pretend to continue on with repo1's publish
    await bumpAndPush(bumpInfo, publishBranch, options);

    // 5. In a brand new cloned repo, make assertions
    const newRepo = repositoryFactory.cloneRepository();
    const newChangePath = path.join(newRepo.rootPath, 'change');
    expect(fs.existsSync(newChangePath)).toBeTruthy();
    const changeFiles = fs.readdirSync(newChangePath);
    expect(changeFiles.length).toBe(1);
    const changeFileContent: ChangeFileInfo = fs.readJSONSync(path.join(newChangePath, changeFiles[0]));
    expect(changeFileContent.packageName).toBe('foo2');
  });
});
