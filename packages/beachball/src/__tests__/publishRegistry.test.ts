import { Registry } from '../fixtures/registry';
import { testTag } from '../fixtures/package';
import { npm } from '../packageManager';
import { writeChangeFiles } from '../changefile';
import { git } from '../git';
import { publish } from '../publish';
import { RepositoryFactory } from '../fixtures/repository';

describe('packageManager', () => {
  let registry: Registry;

  beforeAll(() => {
    registry = new Registry();
    jest.setTimeout(30000);
  });

  afterAll(() => {
    registry.stop();
  });

  describe('publishToRegistry', () => {
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
        push: false,
        registry: registry.getUrl(),
        tag: 'latest',
        token: '',
        yes: true,
        access: 'public',
        package: 'foo',
        changehint: 'Run "beachball change" to create a change file',
        type: null,
        fetch: true,
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
        push: false,
        registry: registry.getUrl(),
        tag: 'latest',
        token: '',
        yes: true,
        access: 'public',
        package: 'foopkg',
        changehint: 'Run "beachball change" to create a change file',
        type: null,
        fetch: true,
      });

      const showResult = npm(['--registry', registry.getUrl(), 'show', 'foopkg', '--json']);

      expect(showResult.success).toBeFalsy();
    });

    fit('can perform a successful npm publish even with a non-existent package listed in the change file', async () => {
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
        push: false,
        registry: registry.getUrl(),
        tag: 'latest',
        token: '',
        yes: true,
        access: 'public',
        package: 'foopkg',
        changehint: 'Run "beachball change" to create a change file',
        type: null,
        fetch: true,
      });

      const showResult = npm(['--registry', registry.getUrl(), 'show', 'badname', '--json']);

      expect(showResult.success).toBeFalsy();
    });
  });
});
