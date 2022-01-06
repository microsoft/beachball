import { Registry } from '../fixtures/registry';
import { npm } from '../packageManager/npm';
import { writeChangeFiles } from '../changefile/writeChangeFiles';
import { git, addGitObserver } from 'workspace-tools';
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

  afterEach(() => {
    if (repositoryFactory) {
      repositoryFactory.cleanUp();
      repositoryFactory = undefined;
    }
  });

  it('can perform a successful npm publish', async () => {
    repositoryFactory = new RepositoryFactory();
    repositoryFactory.create();
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
      bump: true,
      generateChangelog: true,
      dependentChangeType: null,
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

  it('can perform a successful npm publish in detached HEAD', async () => {
    repositoryFactory = new RepositoryFactory();
    repositoryFactory.create();
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

    git(['checkout', '--detach'], { cwd: repo.rootPath });

    await publish({
      all: false,
      authType: 'authtoken',
      branch: 'origin/master',
      command: 'publish',
      message: 'apply package updates',
      path: repo.rootPath,
      publish: true,
      bumpDeps: true,
      push: false,
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
      bump: true,
      generateChangelog: true,
      dependentChangeType: null,
    });

    const showResult = npm(['--registry', registry.getUrl(), 'show', 'foo', '--json']);

    expect(showResult.success).toBeTruthy();

    const show = JSON.parse(showResult.stdout);
    expect(show.name).toEqual('foo');
    expect(show.versions.length).toEqual(1);
    expect(show['dist-tags'].latest).toEqual('1.1.0');
  });

  it('can perform a successful npm publish from a race condition', async () => {
    repositoryFactory = new RepositoryFactory();
    repositoryFactory.create();
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

    // Adds a step that injects a race condition
    let fetchCount = 0;

    addGitObserver((args, output) => {
      if (args[0] === 'fetch') {
        if (fetchCount === 0) {
          const anotherRepo = repositoryFactory!.cloneRepository();
          // inject a checkin
          const packageJsonFile = path.join(anotherRepo.rootPath, 'package.json');
          const contents = JSON.parse(fs.readFileSync(packageJsonFile, 'utf-8'));
          fs.writeFileSync(
            packageJsonFile,
            JSON.stringify(
              {
                ...contents,
                version: '1.0.2',
              },
              null,
              2
            )
          );

          git(['add', packageJsonFile], { cwd: anotherRepo.rootPath });
          git(['commit', '-m', 'test'], { cwd: anotherRepo.rootPath });
          git(['push', 'origin', 'HEAD:master'], { cwd: anotherRepo.rootPath });
        }

        fetchCount++;
      }
    });

    await publish({
      all: false,
      authType: 'authtoken',
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
      bump: true,
      generateChangelog: true,
      dependentChangeType: null,
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

    // this indicates 2 tries
    expect(fetchCount).toBe(2);
  });

  it('can perform a successful npm publish from a race condition in the dependencies', async () => {
    repositoryFactory = new RepositoryFactory();
    repositoryFactory.create();
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

    // Adds a step that injects a race condition
    let fetchCount = 0;

    addGitObserver((args, output) => {
      if (args[0] === 'fetch') {
        if (fetchCount === 0) {
          const anotherRepo = repositoryFactory!.cloneRepository();
          // inject a checkin
          const packageJsonFile = path.join(anotherRepo.rootPath, 'package.json');
          const contents = JSON.parse(fs.readFileSync(packageJsonFile, 'utf-8'));

          delete contents.dependencies.baz;

          fs.writeFileSync(packageJsonFile, JSON.stringify(contents, null, 2));

          git(['add', packageJsonFile], { cwd: anotherRepo.rootPath });
          git(['commit', '-m', 'test'], { cwd: anotherRepo.rootPath });
          git(['push', 'origin', 'HEAD:master'], { cwd: anotherRepo.rootPath });
        }

        fetchCount++;
      }
    });

    await publish({
      all: false,
      authType: 'authtoken',
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
      bump: true,
      generateChangelog: true,
      dependentChangeType: null,
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

    // this indicates 2 tries
    expect(fetchCount).toBe(2);

    const packageJsonFile = path.join(repo.rootPath, 'package.json');
    const contents = JSON.parse(fs.readFileSync(packageJsonFile, 'utf-8'));
    expect(contents.dependencies.baz).toBeUndefined();
  });

  it('can perform a successful npm publish without bump', async () => {
    repositoryFactory = new RepositoryFactory();
    repositoryFactory.create();
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
      bump: false,
      generateChangelog: true,
      dependentChangeType: null,
    });

    const showResult = npm(['--registry', registry.getUrl(), 'show', 'foo', '--json']);

    expect(showResult.success).toBeTruthy();

    const show = JSON.parse(showResult.stdout);
    expect(show.name).toEqual('foo');
    expect(show.versions.length).toEqual(1);
    expect(show['dist-tags'].latest).toEqual('1.0.0');

    git(['checkout', 'master'], { cwd: repo.rootPath });
    git(['pull'], { cwd: repo.rootPath });

    const gitResults = git(['describe', '--abbrev=0'], { cwd: repo.rootPath });
    expect(gitResults.success).toBeFalsy();
  });

  it('should not perform npm publish on out-of-scope package', async () => {
    repositoryFactory = new MonoRepoFactory();
    repositoryFactory.create();
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

    writeChangeFiles({
      changes: [
        {
          type: 'minor',
          comment: 'test',
          email: 'test@test.com',
          packageName: 'bar',
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
      bump: true,
      generateChangelog: true,
      dependentChangeType: null,
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
    repositoryFactory.create();
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
      bump: true,
      generateChangelog: true,
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
      dependentChangeType: null,
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

  it('should respect postpublish hooks', async () => {
    repositoryFactory = new MonoRepoFactory();
    repositoryFactory.create();
    const repo = repositoryFactory.cloneRepository();
    let notified;

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
      bump: true,
      generateChangelog: true,
      hooks: {
        postpublish: packagePath => {
          const packageJsonPath = path.join(packagePath, 'package.json');
          const packageJson = fs.readJSONSync(packageJsonPath);
          if (packageJson.afterPublish) {
            notified = packageJson.afterPublish.notify;
          }
        },
      },
      dependentChangeType: null,
    });

    const fooPackageJson = fs.readJSONSync(path.join(repo.rootPath, 'packages/foo/package.json'));
    expect(fooPackageJson.main).toBe('src/index.ts');
    expect(notified).toBeDefined();
    expect(notified).toBe(fooPackageJson.afterPublish.notify);
  });

  it('can perform a successful npm publish without fetch', async () => {
    repositoryFactory = new RepositoryFactory();
    repositoryFactory.create();
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

    // Adds a step that injects a race condition
    let fetchCount = 0;

    addGitObserver((args, output) => {
      if (args[0] === 'fetch') {
        fetchCount++;
      }
    });

    await publish({
      all: false,
      authType: 'authtoken',
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
      fetch: false,
      disallowedChangeTypes: null,
      defaultNpmTag: 'latest',
      retries: 3,
      bump: true,
      generateChangelog: true,
      dependentChangeType: null,
    });

    const showResult = npm(['--registry', registry.getUrl(), 'show', 'foo', '--json']);

    expect(showResult.success).toBeTruthy();

    const show = JSON.parse(showResult.stdout);
    expect(show.name).toEqual('foo');
    expect(show.versions.length).toEqual(1);
    expect(show['dist-tags'].latest).toEqual('1.1.0');

    // no fetch when flag set to false
    expect(fetchCount).toBe(0);
  });

  it('should specify fetch depth when depth param is defined', async () => {
    repositoryFactory = new RepositoryFactory();
    repositoryFactory.create();
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

    // Adds a step that injects a race condition
    let depthString: string = '';

    addGitObserver((args, output) => {
      if (args[0] === 'fetch') {
        depthString = args[3];
      }
    });

    await publish({
      all: false,
      authType: 'authtoken',
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
      bump: true,
      generateChangelog: true,
      dependentChangeType: null,
      depth: 10
    });

    const showResult = npm(['--registry', registry.getUrl(), 'show', 'foo', '--json']);

    expect(showResult.success).toBeTruthy();

    const show = JSON.parse(showResult.stdout);
    expect(show.name).toEqual('foo');
    expect(show.versions.length).toEqual(1);
    expect(show['dist-tags'].latest).toEqual('1.1.0');

    // no fetch when flag set to false
    expect(depthString).toEqual('--depth=10');
  });

});
