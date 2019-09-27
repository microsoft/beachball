import { Repository, RepositoryFactory, packageJsonFixture } from '../fixtures/repository';
import { publish } from '../publish';
import path from 'path';
import fs from 'fs';
import { writeChangeFiles } from '../changefile';
import { git } from '../git';

describe('publish command', () => {
  let repositoryFactory: RepositoryFactory;

  beforeEach(async () => {
    repositoryFactory = new RepositoryFactory();
    await repositoryFactory.create();
  });

  it('can perform a successful git push', async () => {
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
      publish: false,
      push: true,
      registry: 'http://localhost:99999/',
      tag: 'latest',
      token: '',
      yes: true,
      access: 'public',
      package: 'foo',
      changehint: 'Run "beachball change" to create a change file',
      type: null,
      fetch: true,
    });

    const newRepo = await repositoryFactory.cloneRepository();

    const packageJson = JSON.parse(fs.readFileSync(path.join(newRepo.rootPath, 'package.json'), 'utf-8'));

    expect(packageJson.version).toBe('1.1.0');
  });
});
