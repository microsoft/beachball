import { RepositoryFactory } from '../fixtures/repository';
import { bumpAndPush } from '../publish/bumpAndPush';
import { publish } from '../commands/publish';
import path from 'path';
import fs from 'fs-extra';
import { writeChangeFiles } from '../changefile/writeChangeFiles';
import { git, gitFailFast } from '../git';
import { gatherBumpInfo } from '../bump/gatherBumpInfo';
import { BeachballOptions } from '../types/BeachballOptions';
import { ChangeFileInfo } from '../types/ChangeInfo';

describe('publish command (git)', () => {
  let repositoryFactory: RepositoryFactory;

  beforeAll(() => {
    jest.setTimeout(30000);
  });

  beforeEach(async () => {
    repositoryFactory = new RepositoryFactory();
    await repositoryFactory.create();
  });

  afterEach(async () => {
    await repositoryFactory.cleanUp();
  });

  it('can perform a successful git push', async () => {
    const repo = await repositoryFactory.cloneRepository();

    writeChangeFiles(
      {
        foo: {
          type: 'minor',
          comment: 'test',
          date: new Date('2019-01-01'),
          email: 'test@test.com',
          packageName: 'foo',
          dependentChangeType: 'patch',
        },
      },
      repo.rootPath
    );

    git(['push', 'origin', 'master'], { cwd: repo.rootPath });

    await publish({
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
    });

    const newRepo = await repositoryFactory.cloneRepository();

    const packageJson = fs.readJSONSync(path.join(newRepo.rootPath, 'package.json'));

    expect(packageJson.version).toBe('1.1.0');
  });

  it('can handle a merge when there are change files present', async () => {
    // 1. clone a new repo1, write a change file in repo1
    const repo1 = await repositoryFactory.cloneRepository();

    writeChangeFiles(
      {
        foo: {
          type: 'minor',
          comment: 'test',
          date: new Date('2019-01-01'),
          email: 'test@test.com',
          packageName: 'foo',
          dependentChangeType: 'patch',
        },
      },
      repo1.rootPath
    );

    git(['push', 'origin', 'master'], { cwd: repo1.rootPath });

    // 2. simulate the start of a publish from repo1
    const publishBranch = 'publish_test';
    gitFailFast(['checkout', '-b', publishBranch], { cwd: repo1.rootPath });

    console.log('Bumping version for npm publish');

    const options: BeachballOptions = {
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
    };

    const bumpInfo = gatherBumpInfo(options);

    // 3. Meanwhile, in repo2, also create a new change file
    const repo2 = await repositoryFactory.cloneRepository();

    writeChangeFiles(
      {
        foo2: {
          type: 'minor',
          comment: 'test',
          date: new Date('2019-01-01'),
          email: 'test@test.com',
          packageName: 'foo2',
          dependentChangeType: 'patch',
        },
      },
      repo2.rootPath
    );

    git(['push', 'origin', 'master'], { cwd: repo2.rootPath });

    // 4. Pretend to continue on with repo1's publish
    await bumpAndPush(bumpInfo, publishBranch, options);

    // 5. In a brand new cloned repo, make assertions
    const newRepo = await repositoryFactory.cloneRepository();
    const newChangePath = path.join(newRepo.rootPath, 'change');
    expect(fs.existsSync(newChangePath)).toBeTruthy();
    const changeFiles = fs.readdirSync(newChangePath);
    expect(changeFiles.length).toBe(1);
    const changeFileContent: ChangeFileInfo = fs.readJSONSync(path.join(newChangePath, changeFiles[0]));
    expect(changeFileContent.packageName).toBe('foo2');
  });
});
