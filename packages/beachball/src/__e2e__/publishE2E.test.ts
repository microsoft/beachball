import { Registry } from '../fixtures/registry';
import { npm } from '../packageManager/npm';
import { writeChangeFiles } from '../changefile/writeChangeFiles';
import { git } from '../git';
import { publish } from '../commands/publish';
import { RepositoryFactory } from '../fixtures/repository';
import { MonoRepoFactory } from '../fixtures/monorepo';
import fs from 'fs';
import path from 'path';
import { BumpInfo } from '../types/BumpInfo';

describe('publish command (e2e)', () => {
  let registry: Registry;
  let repositoryFactory: RepositoryFactory | undefined;

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

  afterEach(async () => {
    if (repositoryFactory) {
      await repositoryFactory.cleanUp();
      repositoryFactory = undefined;
    }
  });

  it('can perform a successful npm publish', async () => {
    repositoryFactory = new RepositoryFactory();
    await repositoryFactory.create();
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
      publish: true,
      bumpDeps: true,
      push: true,
      registry: registry.getUrl(),
      tag: 'latest',
      token: '',
      yes: true,
      new: false,
      access: 'public',
      package: '',
      changehint: 'Run "beachball change" to create a change file',
      type: null,
      fetch: true,
      disallowedChangeTypes: null,
      defaultNpmTag: 'latest',
      retries: 3,
    });

    const showResult = npm(['--registry', registry.getUrl(), 'show', 'foo', '--json']);

    expect(showResult.success).toBeTruthy();

    const show = JSON.parse(showResult.stdout);
    expect(show.name).toEqual('foo');
    expect(show.versions.length).toEqual(1);
    expect(show['dist-tags'].latest).toEqual('1.1.0');

    git(['checkout', 'master'], { cwd: repo.rootPath });
    git(['pull'], { cwd: repo.rootPath });
    const gitResults = git(['describe', '--abbrev=0'], { cwd: repo.rootPath });

    expect(gitResults.success).toBeTruthy();
    expect(gitResults.stdout).toBe('foo_v1.1.0');
  });

  it('should not perform npm publish on out-of-scope package', async () => {
    repositoryFactory = new MonoRepoFactory();
    await repositoryFactory.create();
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

    writeChangeFiles(
      {
        bar: {
          type: 'minor',
          comment: 'test',
          date: new Date('2019-01-01'),
          email: 'test@test.com',
          packageName: 'bar',
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
      publish: true,
      bumpDeps: true,
      push: true,
      registry: registry.getUrl(),
      tag: 'latest',
      token: '',
      yes: true,
      new: false,
      access: 'public',
      package: '',
      changehint: 'Run "beachball change" to create a change file',
      type: null,
      fetch: true,
      disallowedChangeTypes: null,
      defaultNpmTag: 'latest',
      scope: ['!packages/foo'],
      retries: 3,
    });

    const fooNpmResult = npm(['--registry', registry.getUrl(), 'show', 'foo', '--json']);
    expect(fooNpmResult.success).toBeFalsy();

    const fooGitResults = git(['describe', '--abbrev=0'], { cwd: repo.rootPath });
    expect(fooGitResults.success).toBeFalsy();

    const barNpmResult = npm(['--registry', registry.getUrl(), 'show', 'bar', '--json']);

    expect(barNpmResult.success).toBeTruthy();

    const show = JSON.parse(barNpmResult.stdout);
    expect(show.name).toEqual('bar');
    expect(show.versions.length).toEqual(1);
    expect(show['dist-tags'].latest).toEqual('1.4.0');

    git(['checkout', 'master'], { cwd: repo.rootPath });
    git(['pull'], { cwd: repo.rootPath });
    const barGitResults = git(['describe', '--abbrev=0'], { cwd: repo.rootPath });

    expect(barGitResults.success).toBeTruthy();
    expect(barGitResults.stdout).toBe('bar_v1.4.0');
  });

  it('should respect prepublish hooks', async () => {
    repositoryFactory = new MonoRepoFactory();
    await repositoryFactory.create();
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
      publish: true,
      bumpDeps: true,
      push: true,
      registry: registry.getUrl(),
      tag: 'latest',
      token: '',
      yes: true,
      new: false,
      access: 'public',
      package: '',
      changehint: 'Run "beachball change" to create a change file',
      type: null,
      fetch: true,
      disallowedChangeTypes: null,
      defaultNpmTag: 'latest',
      retries: 3,
      hooks: {
        prepublish: (bumpInfo: BumpInfo) => {
          bumpInfo.packageInfos.foo.version = bumpInfo.packageInfos.foo.version + '-beta';
        }
      }
    });

    // All npm results should refer to 1.1.0-beta (the mod in the publish step above)    
    const fooNpmResult = npm(['--registry', registry.getUrl(), 'show', 'foo', '--json']);
    expect(fooNpmResult.success).toBeTruthy();
    const show = JSON.parse(fooNpmResult.stdout);
    expect(show.name).toEqual('foo');
    expect(show.versions.length).toEqual(1);
    expect(show['dist-tags'].latest).toEqual('1.1.0-beta');

    git(['checkout', 'master'], { cwd: repo.rootPath });
    git(['pull'], { cwd: repo.rootPath });

    // All git results should refer to 1.1.0
    const fooGitResults = git(['describe', '--abbrev=0'], { cwd: repo.rootPath });
    expect(fooGitResults.success).toBeTruthy();
    expect(fooGitResults.stdout).toBe('foo_v1.1.0');

    const fooPackageJson = JSON.parse(fs.readFileSync(path.join(repo.rootPath, 'packages/foo/package.json'), 'utf-8'));
    expect(fooPackageJson.version).toBe('1.1.0');
  });
});
