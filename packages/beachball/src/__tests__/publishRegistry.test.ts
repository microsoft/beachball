import { Registry } from '../fixtures/registry';
import { npm } from '../packageManager/npm';
import { writeChangeFiles } from '../changefile/writeChangeFiles';
import { git } from '../git';
import { publish } from '../commands/publish';
import { RepositoryFactory } from '../fixtures/repository';

describe('publishToRegistry', () => {
  let registry: Registry;

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

  it('can perform a successful npm publish', async () => {
    const repositoryFactory = new RepositoryFactory();
    await repositoryFactory.create();
    const repo = await repositoryFactory.cloneRepository();

    writeChangeFiles(
      {
        foo: {
          type: 'minor',
          comment: 'test',
          commit: 'test',
          date: new Date('2019-01-01'),
          email: 'test@test.com',
          packageName: 'foo',
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
      bumpDeps: false,
      push: false,
      registry: registry.getUrl(),
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
    });

    const showResult = npm(['--registry', registry.getUrl(), 'show', 'foo', '--json']);

    expect(showResult.success).toBeTruthy();

    const show = JSON.parse(showResult.stdout);
    expect(show.name).toEqual('foo');
    expect(show.versions.length).toEqual(1);
  });

  it('can perform a successful npm publish even with private packages', async () => {
    const repositoryFactory = new RepositoryFactory();
    await repositoryFactory.create();
    const repo = await repositoryFactory.cloneRepository();

    await repo.commitChange(
      'packages/foopkg/package.json',
      JSON.stringify({
        name: 'foopkg',
        version: '1.0.0',
        private: true,
      })
    );

    await repo.commitChange(
      'packages/publicpkg/package.json',
      JSON.stringify({
        name: 'publicpkg',
        version: '1.0.0',
      })
    );

    await repo.commitChange(
      'package.json',
      JSON.stringify({
        name: 'foo-repo',
        version: '1.0.0',
        private: true,
      })
    );

    writeChangeFiles(
      {
        foopkg: {
          type: 'minor',
          comment: 'test',
          commit: 'test',
          date: new Date('2019-01-01'),
          email: 'test@test.com',
          packageName: 'foopkg',
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
      bumpDeps: false,
      push: false,
      registry: registry.getUrl(),
      tag: 'latest',
      token: '',
      yes: true,
      new: false,
      access: 'public',
      package: 'foopkg',
      changehint: 'Run "beachball change" to create a change file',
      type: null,
      fetch: true,
      disallowedChangeTypes: null,
      defaultNpmTag: 'latest',
    });

    const showResult = npm(['--registry', registry.getUrl(), 'show', 'foopkg', '--json']);

    expect(showResult.success).toBeFalsy();
  });

  it('can perform a successful npm publish even with a non-existent package listed in the change file', async () => {
    const repositoryFactory = new RepositoryFactory();
    await repositoryFactory.create();
    const repo = await repositoryFactory.cloneRepository();

    await repo.commitChange(
      'packages/foopkg/package.json',
      JSON.stringify({
        name: 'foopkg',
        version: '1.0.0',
      })
    );

    await repo.commitChange(
      'packages/publicpkg/package.json',
      JSON.stringify({
        name: 'publicpkg',
        version: '1.0.0',
      })
    );

    await repo.commitChange(
      'package.json',
      JSON.stringify({
        name: 'foo-repo',
        version: '1.0.0',
        private: true,
      })
    );

    writeChangeFiles(
      {
        badname: {
          type: 'minor',
          comment: 'test',
          commit: 'test',
          date: new Date('2019-01-01'),
          email: 'test@test.com',
          packageName: 'badname',
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
      bumpDeps: false,
      push: false,
      registry: registry.getUrl(),
      tag: 'latest',
      token: '',
      yes: true,
      new: false,
      access: 'public',
      package: 'foopkg',
      changehint: 'Run "beachball change" to create a change file',
      type: null,
      fetch: true,
      disallowedChangeTypes: null,
      defaultNpmTag: 'latest',
    });

    const showResult = npm(['--registry', registry.getUrl(), 'show', 'badname', '--json']);

    expect(showResult.success).toBeFalsy();
  });
});
