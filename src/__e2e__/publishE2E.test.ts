import { describe, expect, it, beforeAll, beforeEach, afterAll, afterEach, jest } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import { addGitObserver, clearGitObservers } from 'workspace-tools';
import { generateChangeFiles } from '../__fixtures__/changeFiles';
import { defaultBranchName, defaultRemoteBranchName } from '../__fixtures__/gitDefaults';
import { initMockLogs } from '../__fixtures__/mockLogs';
import { npmShow, NpmShowResult } from '../__fixtures__/npmShow';
import { Registry } from '../__fixtures__/registry';
import { Repository } from '../__fixtures__/repository';
import { RepositoryFactory } from '../__fixtures__/repositoryFactory';
import { publish } from '../commands/publish';
import { getDefaultOptions } from '../options/getDefaultOptions';
import { BeachballOptions } from '../types/BeachballOptions';

describe('publish command (e2e)', () => {
  let registry: Registry;
  let repositoryFactory: RepositoryFactory | undefined;

  // show error logs for these tests
  initMockLogs({ alsoLog: ['error'] });

  function getOptions(repo: Repository, overrides?: Partial<BeachballOptions>): BeachballOptions {
    return {
      ...getDefaultOptions(),
      branch: defaultRemoteBranchName,
      registry: registry.getUrl(),
      path: repo.rootPath,
      command: 'publish',
      message: 'apply package updates',
      tag: 'latest',
      yes: true,
      access: 'public',
      ...overrides,
    };
  }

  beforeAll(() => {
    registry = new Registry(__filename);
    jest.setTimeout(30000);
  });

  afterAll(() => {
    registry.stop();
  });

  beforeEach(async () => {
    await registry.reset();
  });

  afterEach(() => {
    clearGitObservers();

    if (repositoryFactory) {
      repositoryFactory.cleanUp();
      repositoryFactory = undefined;
    }
  });

  it('can perform a successful npm publish', async () => {
    repositoryFactory = new RepositoryFactory('single');
    const repo = repositoryFactory.cloneRepository();

    generateChangeFiles(['foo'], repo.rootPath);

    repo.push();

    await publish(getOptions(repo));

    const expectedNpmResult: NpmShowResult = {
      name: 'foo',
      versions: ['1.1.0'],
      'dist-tags': { latest: '1.1.0' },
    };
    expect(npmShow(registry, 'foo')).toMatchObject(expectedNpmResult);

    repo.checkout(defaultBranchName);
    repo.pull();
    expect(repo.getCurrentTags()).toEqual(['foo_v1.1.0']);
  });

  it('can perform a successful npm publish in detached HEAD', async () => {
    repositoryFactory = new RepositoryFactory('single');
    const repo = repositoryFactory.cloneRepository();

    generateChangeFiles(['foo'], repo.rootPath);

    repo.push();

    repo.checkout('--detach');

    await publish(getOptions(repo, { push: false }));

    const expectedNpmResult: NpmShowResult = {
      name: 'foo',
      versions: ['1.1.0'],
      'dist-tags': { latest: '1.1.0' },
    };
    expect(npmShow(registry, 'foo')).toMatchObject(expectedNpmResult);
  });

  it('can perform a successful npm publish from a race condition', async () => {
    repositoryFactory = new RepositoryFactory('single');
    const repo = repositoryFactory.cloneRepository();

    generateChangeFiles(['foo'], repo.rootPath);

    repo.push();

    // Adds a step that injects a race condition
    let fetchCount = 0;

    addGitObserver((args, output) => {
      if (args[0] === 'fetch') {
        if (fetchCount === 0) {
          const anotherRepo = repositoryFactory!.cloneRepository();
          // inject a checkin
          anotherRepo.updateJsonFile('package.json', { version: '1.0.2' });
          anotherRepo.push();
        }

        fetchCount++;
      }
    });

    await publish(getOptions(repo));

    const expectedNpmResult: NpmShowResult = {
      name: 'foo',
      versions: ['1.1.0'],
      'dist-tags': { latest: '1.1.0' },
    };
    expect(npmShow(registry, 'foo')).toMatchObject(expectedNpmResult);

    repo.checkout(defaultBranchName);
    repo.pull();
    expect(repo.getCurrentTags()).toEqual(['foo_v1.1.0']);

    // this indicates 2 tries
    expect(fetchCount).toBe(2);
  });

  it('can perform a successful npm publish from a race condition in the dependencies', async () => {
    repositoryFactory = new RepositoryFactory('single');
    const repo = repositoryFactory.cloneRepository();

    generateChangeFiles(['foo'], repo.rootPath);

    repo.push();

    // Adds a step that injects a race condition
    let fetchCount = 0;

    addGitObserver((args, output) => {
      if (args[0] === 'fetch') {
        if (fetchCount === 0) {
          const anotherRepo = repositoryFactory!.cloneRepository();
          // inject a checkin
          const packageJsonFile = anotherRepo.pathTo('package.json');
          const contents = fs.readJSONSync(packageJsonFile, 'utf-8');
          delete contents.dependencies.baz;
          anotherRepo.commitChange('package.json', JSON.stringify(contents, null, 2));
          anotherRepo.push();
        }

        fetchCount++;
      }
    });

    await publish(getOptions(repo));

    const expectedNpmResult: NpmShowResult = {
      name: 'foo',
      versions: ['1.1.0'],
      'dist-tags': { latest: '1.1.0' },
    };
    expect(npmShow(registry, 'foo')).toMatchObject(expectedNpmResult);

    repo.checkout(defaultBranchName);
    repo.pull();
    expect(repo.getCurrentTags()).toEqual(['foo_v1.1.0']);

    // this indicates 2 tries
    expect(fetchCount).toBe(2);

    const packageJsonFile = repo.pathTo('package.json');
    const contents = JSON.parse(fs.readFileSync(packageJsonFile, 'utf-8'));
    expect(contents.dependencies.baz).toBeUndefined();
  });

  it('can perform a successful npm publish without bump', async () => {
    repositoryFactory = new RepositoryFactory('single');
    const repo = repositoryFactory.cloneRepository();

    generateChangeFiles(['foo'], repo.rootPath);

    repo.push();

    await publish(getOptions(repo, { bump: false }));

    const expectedNpmResult: NpmShowResult = {
      name: 'foo',
      versions: ['1.0.0'],
      'dist-tags': { latest: '1.0.0' },
    };
    expect(npmShow(registry, 'foo')).toMatchObject(expectedNpmResult);

    repo.checkout(defaultBranchName);
    repo.pull();
    expect(repo.getCurrentTags()).toEqual([]);
  });

  it('should not perform npm publish on out-of-scope package', async () => {
    repositoryFactory = new RepositoryFactory('monorepo');
    const repo = repositoryFactory.cloneRepository();

    generateChangeFiles(['foo'], repo.rootPath);
    generateChangeFiles(['bar'], repo.rootPath);

    repo.push();

    await publish(getOptions(repo, { scope: ['!packages/foo'] }));

    npmShow(registry, 'foo', true /*shouldFail*/);

    expect(repo.getCurrentTags()).toEqual([]);

    const expectedNpmResult: NpmShowResult = {
      name: 'bar',
      versions: ['1.4.0'],
      'dist-tags': { latest: '1.4.0' },
    };
    expect(npmShow(registry, 'bar')).toMatchObject(expectedNpmResult);

    repo.checkout(defaultBranchName);
    repo.pull();
    expect(repo.getCurrentTags()).toEqual(['bar_v1.4.0']);
  });

  it('should respect prepublish hooks', async () => {
    repositoryFactory = new RepositoryFactory('monorepo');
    const repo = repositoryFactory.cloneRepository();

    generateChangeFiles(['foo'], repo.rootPath);

    repo.push();

    await publish(
      getOptions(repo, {
        path: repo.rootPath,
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
      })
    );

    // Query the information from package.json from the registry to see if it was successfully patched
    const show = npmShow(registry, 'foo')!;
    expect(show.name).toEqual('foo');
    expect(show.main).toEqual('lib/index.js');
    expect(show.hasOwnProperty('onPublish')).toBeFalsy();

    repo.checkout(defaultBranchName);
    repo.pull();

    // All git results should still have previous information
    expect(repo.getCurrentTags()).toEqual(['foo_v1.1.0']);
    const fooPackageJson = fs.readJSONSync(repo.pathTo('packages/foo/package.json'));
    expect(fooPackageJson.main).toBe('src/index.ts');
    expect(fooPackageJson.onPublish.main).toBe('lib/index.js');
  });

  it('should respect postpublish hooks', async () => {
    repositoryFactory = new RepositoryFactory('monorepo');
    const repo = repositoryFactory.cloneRepository();
    let notified;

    generateChangeFiles(['foo'], repo.rootPath);

    repo.push();

    await publish(
      getOptions(repo, {
        path: repo.rootPath,
        hooks: {
          postpublish: packagePath => {
            const packageJsonPath = path.join(packagePath, 'package.json');
            const packageJson = fs.readJSONSync(packageJsonPath);
            if (packageJson.afterPublish) {
              notified = packageJson.afterPublish.notify;
            }
          },
        },
      })
    );

    const fooPackageJson = fs.readJSONSync(repo.pathTo('packages/foo/package.json'));
    expect(fooPackageJson.main).toBe('src/index.ts');
    expect(notified).toBe(fooPackageJson.afterPublish.notify);
  });

  it('can perform a successful npm publish without fetch', async () => {
    repositoryFactory = new RepositoryFactory('single');
    const repo = repositoryFactory.cloneRepository();

    generateChangeFiles(['foo'], repo.rootPath);

    repo.push();

    // Adds a step that injects a race condition
    let fetchCount = 0;

    addGitObserver((args, output) => {
      if (args[0] === 'fetch') {
        fetchCount++;
      }
    });

    await publish(getOptions(repo, { fetch: false }));

    const expectedNpmResult: NpmShowResult = {
      name: 'foo',
      versions: ['1.1.0'],
      'dist-tags': { latest: '1.1.0' },
    };
    expect(npmShow(registry, 'foo')).toMatchObject(expectedNpmResult);

    // no fetch when flag set to false
    expect(fetchCount).toBe(0);
  });

  it('should specify fetch depth when depth param is defined', async () => {
    repositoryFactory = new RepositoryFactory('single');
    const repo = repositoryFactory.cloneRepository();

    generateChangeFiles(['foo'], repo.rootPath);

    repo.push();

    let fetchCommand: string = '';

    addGitObserver((args, output) => {
      if (args[0] === 'fetch') {
        fetchCommand = args.join(' ');
      }
    });

    await publish(getOptions(repo, { depth: 10 }));

    const expectedNpmResult: NpmShowResult = {
      name: 'foo',
      versions: ['1.1.0'],
      'dist-tags': { latest: '1.1.0' },
    };
    expect(npmShow(registry, 'foo')).toMatchObject(expectedNpmResult);

    expect(fetchCommand).toMatch('--depth=10');
  });

  it('calls precommit hook before committing changes', async () => {
    repositoryFactory = new RepositoryFactory('monorepo');
    const repo = repositoryFactory.cloneRepository();

    generateChangeFiles(['foo'], repo.rootPath);

    repo.push();

    await publish(
      getOptions(repo, {
        path: repo.rootPath,
        hooks: {
          precommit: async cwd => {
            await new Promise(resolve => {
              fs.writeFile(path.resolve(cwd, 'foo.txt'), 'foo', resolve);
            });
          },
        },
      })
    );

    repo.checkout(defaultBranchName);
    repo.pull();

    // All git results should still have previous information
    expect(repo.getCurrentTags()).toEqual(['foo_v1.1.0']);
    const manifestJson = fs.readFileSync(repo.pathTo('foo.txt'));
    expect(manifestJson.toString()).toMatchInlineSnapshot(`"foo"`);
  });
});
