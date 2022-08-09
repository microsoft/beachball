import fs from 'fs-extra';
import path from 'path';
import { git, gitFailFast } from 'workspace-tools';
import { initMockLogs } from '../__fixtures__/mockLogs';
import { RepositoryFactory } from '../__fixtures__/repository';
import { bumpAndPush } from '../publish/bumpAndPush';
import { publish } from '../commands/publish';
import { writeChangeFiles } from '../changefile/writeChangeFiles';
import { gatherBumpInfo } from '../bump/gatherBumpInfo';
import { BeachballOptions } from '../types/BeachballOptions';
import { ChangeFileInfo } from '../types/ChangeInfo';
import { getPackageInfos } from '../monorepo/getPackageInfos';

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

    await publish({
      all: false,
      authType: 'authtoken',
      branch: 'origin/master',
      command: 'publish',
      message: 'apply package updates',
      path: repo.rootPath,
      publish: false,
      bumpDeps: false,
      push: true,
      registry: 'http://localhost:99999/',
      gitTags: true,
      tag: 'latest',
      token: '',
      new: false,
      yes: true,
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

    console.log('Bumping version for npm publish');

    const options: BeachballOptions = {
      all: false,
      authType: 'authtoken',
      branch: 'origin/master',
      command: 'publish',
      message: 'apply package updates',
      path: repo1.rootPath,
      publish: false,
      bumpDeps: false,
      push: true,
      registry: 'http://localhost:99999/',
      gitTags: true,
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
    };

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
