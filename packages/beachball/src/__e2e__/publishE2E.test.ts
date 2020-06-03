import { Registry } from '../fixtures/registry';
import { npm } from '../packageManager/npm';
import { writeChangeFiles } from '../changefile/writeChangeFiles';
import { git } from '../git';
import { publish } from '../commands/publish';
import { RepositoryFactory } from '../fixtures/repository';
import { MonoRepoFactory } from '../fixtures/monorepo';
import fs from 'fs-extra';
import path from 'path';

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
      gitTags: true,
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
      gitTags: true,
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
    const barGitResults = git(['describe', '--abbrev=0', 'bar_v1.4.0'], { cwd: repo.rootPath });

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
      gitTags: true,
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
        prepublish: (packagePath: string) => {
          const packageJsonPath = path.join(packagePath, 'package.json');
          const packageJson = fs.readJSONSync(packageJsonPath);
          if (packageJson.onPublish) {
            Object.assign(packageJson, packageJson.onPublish);
            delete packageJson.onPublish;
            fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
          }
        },
      },
    });

    // Query the information from package.json from the registry to see if it was successfully patched
    const fooNpmResult = npm(['--registry', registry.getUrl(), 'show', 'foo', '--json']);
    expect(fooNpmResult.success).toBeTruthy();
    const show = JSON.parse(fooNpmResult.stdout);
    expect(show.name).toEqual('foo');
    expect(show.main).toEqual('lib/index.js');
    expect(show.hasOwnProperty('onPublish')).toBeFalsy();

    git(['checkout', 'master'], { cwd: repo.rootPath });
    git(['pull'], { cwd: repo.rootPath });

    // All git results should still have previous information
    const fooGitResults = git(['describe', '--abbrev=0'], { cwd: repo.rootPath });
    expect(fooGitResults.success).toBeTruthy();
    const fooPackageJson = fs.readJSONSync(path.join(repo.rootPath, 'packages/foo/package.json'));
    expect(fooPackageJson.main).toBe('src/index.ts');
    expect(fooPackageJson.onPublish.main).toBe('lib/index.js');
  });
});
