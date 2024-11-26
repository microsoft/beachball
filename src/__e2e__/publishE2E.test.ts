import { describe, expect, it, afterEach, jest } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import { addGitObserver, clearGitObservers } from 'workspace-tools';
import { generateChangeFiles } from '../__fixtures__/changeFiles';
import { defaultBranchName, defaultRemoteBranchName } from '../__fixtures__/gitDefaults';
import { initMockLogs } from '../__fixtures__/mockLogs';
import { npmShow } from '../__fixtures__/npmShow';
import type { Repository } from '../__fixtures__/repository';
import { type PackageJsonFixture, RepositoryFactory } from '../__fixtures__/repositoryFactory';
import { publish } from '../commands/publish';
import { getDefaultOptions } from '../options/getDefaultOptions';
import type { BeachballOptions } from '../types/BeachballOptions';
import { _mockNpmPublish, initNpmMock } from '../__fixtures__/mockNpm';
import type { PackageJson } from '../types/PackageInfo';

// Spawning actual npm to run commands against a fake registry is extremely slow, so mock it for
// this test (packagePublish covers the more complete npm registry scenario).
//
// If an issue is found in the future that could only be caught by this test using real npm,
// a new test file with a real registry should be created to cover that specific scenario.
jest.mock('../packageManager/npm');

describe('publish command (e2e)', () => {
  const npmMock = initNpmMock();

  let repositoryFactory: RepositoryFactory | undefined;
  let repo: Repository | undefined;

  // show error logs for these tests
  const logs = initMockLogs({ alsoLog: ['error'] });

  function getOptions(overrides?: Partial<BeachballOptions>): BeachballOptions {
    return {
      ...getDefaultOptions(),
      branch: defaultRemoteBranchName,
      registry: 'fake',
      // change to ?. if a future test uses a non-standard repo
      path: repo!.rootPath,
      command: 'publish',
      message: 'apply package updates',
      tag: 'latest',
      yes: true,
      access: 'public',
      ...overrides,
    };
  }

  afterEach(() => {
    clearGitObservers();

    repositoryFactory?.cleanUp();
    repositoryFactory = undefined;
    repo = undefined;
  });

  it('can perform a successful npm publish', async () => {
    repositoryFactory = new RepositoryFactory('single');
    repo = repositoryFactory.cloneRepository();

    const options = getOptions();

    generateChangeFiles(['foo'], options);
    repo.push();

    await publish(options);

    expect(await npmShow('foo')).toMatchObject({
      name: 'foo',
      versions: ['1.1.0'],
      'dist-tags': { latest: '1.1.0' },
    });

    repo.checkout(defaultBranchName);
    repo.pull();
    expect(repo.getCurrentTags()).toEqual(['foo_v1.1.0']);
  });

  it('can perform a successful npm publish in detached HEAD', async () => {
    repositoryFactory = new RepositoryFactory('single');
    repo = repositoryFactory.cloneRepository();

    const options = getOptions({
      push: false,
    });

    generateChangeFiles(['foo'], options);
    repo.push();

    repo.checkout('--detach');

    await publish(options);

    expect(await npmShow('foo')).toMatchObject({
      name: 'foo',
      versions: ['1.1.0'],
      'dist-tags': { latest: '1.1.0' },
    });
  });

  it('can perform a successful npm publish from a race condition', async () => {
    repositoryFactory = new RepositoryFactory('single');
    repo = repositoryFactory.cloneRepository();

    const options = getOptions();

    generateChangeFiles(['foo'], options);
    repo.push();

    // Adds a step that injects a race condition
    let fetchCount = 0;

    addGitObserver(args => {
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

    await publish(options);

    expect(await npmShow('foo')).toMatchObject({
      name: 'foo',
      versions: ['1.1.0'],
      'dist-tags': { latest: '1.1.0' },
    });

    repo.checkout(defaultBranchName);
    repo.pull();
    expect(repo.getCurrentTags()).toEqual(['foo_v1.1.0']);

    // this indicates 2 tries
    expect(fetchCount).toBe(2);
  });

  it('can perform a successful npm publish from a race condition in the dependencies', async () => {
    repositoryFactory = new RepositoryFactory('single');
    repo = repositoryFactory.cloneRepository();

    const options = getOptions();

    generateChangeFiles(['foo'], options);
    repo.push();

    // Adds a step that injects a race condition
    let fetchCount = 0;

    addGitObserver(args => {
      if (args[0] === 'fetch') {
        if (fetchCount === 0) {
          const anotherRepo = repositoryFactory!.cloneRepository();
          // inject a checkin
          const packageJsonFile = anotherRepo.pathTo('package.json');
          const contents = fs.readJSONSync(packageJsonFile, 'utf-8') as PackageJson;
          delete contents.dependencies?.baz;
          anotherRepo.commitChange('package.json', JSON.stringify(contents, null, 2));
          anotherRepo.push();
        }

        fetchCount++;
      }
    });

    await publish(options);

    expect(await npmShow('foo')).toMatchObject({
      name: 'foo',
      versions: ['1.1.0'],
      'dist-tags': { latest: '1.1.0' },
    });

    repo.checkout(defaultBranchName);
    repo.pull();
    expect(repo.getCurrentTags()).toEqual(['foo_v1.1.0']);

    // this indicates 2 tries
    expect(fetchCount).toBe(2);

    const packageJsonFile = repo.pathTo('package.json');
    const contents = JSON.parse(fs.readFileSync(packageJsonFile, 'utf-8')) as PackageJson;
    expect(contents.dependencies?.baz).toBeUndefined();
  });

  it('can perform a successful npm publish without bump', async () => {
    repositoryFactory = new RepositoryFactory('single');
    repo = repositoryFactory.cloneRepository();

    const options = getOptions({ bump: false });

    generateChangeFiles(['foo'], options);

    repo.push();

    await publish(options);

    expect(await npmShow('foo')).toMatchObject({
      name: 'foo',
      versions: ['1.0.0'],
      'dist-tags': { latest: '1.0.0' },
    });

    repo.checkout(defaultBranchName);
    repo.pull();
    expect(repo.getCurrentTags()).toEqual([]);
  });

  it('publishes only changed packages in a monorepo', async () => {
    repositoryFactory = new RepositoryFactory('monorepo');
    repo = repositoryFactory.cloneRepository();

    const options = getOptions();

    generateChangeFiles(['foo'], options);
    repo.push();

    await publish(options);

    await npmShow('bar', { shouldFail: true });

    expect(await npmShow('foo')).toMatchObject({
      name: 'foo',
      versions: ['1.1.0'],
      'dist-tags': { latest: '1.1.0' },
    });

    repo.checkout(defaultBranchName);
    repo.pull();
    expect(repo.getCurrentTags()).toEqual(['foo_v1.1.0']);
  });

  it('publishes dependent packages in a monorepo', async () => {
    repositoryFactory = new RepositoryFactory('monorepo');
    repo = repositoryFactory.cloneRepository();

    const options = getOptions();

    // bump baz => dependent bump bar => dependent bump foo
    generateChangeFiles(['baz'], options);
    expect(repositoryFactory.fixture.folders.packages.foo.dependencies!.bar).toBeTruthy();
    expect(repositoryFactory.fixture.folders.packages.bar.dependencies!.baz).toBeTruthy();
    repo.push();

    await publish(options);

    expect(await npmShow('baz')).toMatchObject({
      name: 'baz',
      versions: ['1.4.0'],
      'dist-tags': { latest: '1.4.0' },
    });

    expect(await npmShow('bar')).toMatchObject({
      name: 'bar',
      versions: ['1.3.5'],
      'dist-tags': { latest: '1.3.5' },
      dependencies: { baz: '^1.4.0' },
    });

    expect(await npmShow('foo')).toMatchObject({
      name: 'foo',
      versions: ['1.0.1'],
      'dist-tags': { latest: '1.0.1' },
      dependencies: { bar: '^1.3.5' },
    });

    repo.checkout(defaultBranchName);
    repo.pull();
    expect(repo.getCurrentTags()).toEqual(['bar_v1.3.5', 'baz_v1.4.0', 'foo_v1.0.1']);
  });

  it('publishes new monorepo packages if requested', async () => {
    // use a slightly smaller fixture to only publish one extra package
    repositoryFactory = new RepositoryFactory({
      folders: {
        packages: { foo: { version: '1.0.0' }, bar: { version: '1.3.4' } },
      },
    });
    repo = repositoryFactory.cloneRepository();

    const options = getOptions({
      new: true,
    });

    generateChangeFiles(['foo'], options);
    repo.push();

    await publish(options);

    expect(await npmShow('foo')).toMatchObject({ name: 'foo', versions: ['1.1.0'] });
    expect(await npmShow('bar')).toMatchObject({ name: 'bar', versions: ['1.3.4'] });

    repo.checkout(defaultBranchName);
    repo.pull();
    expect(repo.getCurrentTags()).toEqual(['bar_v1.3.4', 'foo_v1.1.0']);
  });

  it('should not perform npm publish on out-of-scope package', async () => {
    repositoryFactory = new RepositoryFactory('monorepo');
    repo = repositoryFactory.cloneRepository();

    const options = getOptions({ scope: ['!packages/foo'] });

    generateChangeFiles(['foo'], options);
    generateChangeFiles(['bar'], options);
    repo.push();

    await publish(options);

    await npmShow('foo', { shouldFail: true });

    expect(repo.getCurrentTags()).toEqual([]);

    expect(await npmShow('bar')).toMatchObject({
      name: 'bar',
      versions: ['1.4.0'],
      'dist-tags': { latest: '1.4.0' },
    });

    repo.checkout(defaultBranchName);
    repo.pull();
    expect(repo.getCurrentTags()).toEqual(['bar_v1.4.0']);
  });

  it('should respect prepublish hooks', async () => {
    repositoryFactory = new RepositoryFactory('monorepo');
    repo = repositoryFactory.cloneRepository();

    type ExtraPackageJson = PackageJson & { onPublish?: { main: string } };

    const options = getOptions({
      hooks: {
        prepublish: (packagePath: string) => {
          const packageJsonPath = path.join(packagePath, 'package.json');
          const packageJson = fs.readJSONSync(packageJsonPath) as ExtraPackageJson;
          if (packageJson.onPublish) {
            Object.assign(packageJson, packageJson.onPublish);
            delete packageJson.onPublish;
            fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
          }
        },
      },
    });

    generateChangeFiles(['foo'], options);
    repo.push();

    await publish(options);

    // Query the information from package.json from the registry to see if it was successfully patched
    const show = (await npmShow('foo'))!;
    expect(show.name).toEqual('foo');
    expect(show.main).toEqual('lib/index.js');
    expect(show).not.toHaveProperty('onPublish');

    repo.checkout(defaultBranchName);
    repo.pull();

    // All git results should still have previous information
    expect(repo.getCurrentTags()).toEqual(['foo_v1.1.0']);
    const fooPackageJson = fs.readJSONSync(repo.pathTo('packages/foo/package.json')) as ExtraPackageJson;
    expect(fooPackageJson.main).toBe('src/index.ts');
    expect(fooPackageJson.onPublish?.main).toBe('lib/index.js');
  });

  it('should respect postpublish hooks', async () => {
    repositoryFactory = new RepositoryFactory('monorepo');
    repo = repositoryFactory.cloneRepository();
    let notified;

    type ExtraPackageJson = PackageJson & { afterPublish?: { notify: string } };

    const options = getOptions({
      hooks: {
        postpublish: packagePath => {
          const packageJsonPath = path.join(packagePath, 'package.json');
          const packageJson = fs.readJSONSync(packageJsonPath) as ExtraPackageJson;
          if (packageJson.afterPublish) {
            notified = packageJson.afterPublish.notify;
          }
        },
      },
    });

    generateChangeFiles(['foo'], options);
    repo.push();

    await publish(options);

    const fooPackageJson = fs.readJSONSync(repo.pathTo('packages/foo/package.json')) as ExtraPackageJson;
    expect(fooPackageJson.main).toBe('src/index.ts');
    expect(notified).toBe(fooPackageJson.afterPublish?.notify);
  });

  it('can perform a successful npm publish without fetch', async () => {
    repositoryFactory = new RepositoryFactory('single');
    repo = repositoryFactory.cloneRepository();

    const options = getOptions({
      fetch: false,
    });

    generateChangeFiles(['foo'], options);
    repo.push();

    let fetchCount = 0;

    addGitObserver(args => {
      if (args[0] === 'fetch') {
        fetchCount++;
      }
    });

    await publish(options);

    expect(await npmShow('foo')).toMatchObject({
      name: 'foo',
      versions: ['1.1.0'],
      'dist-tags': { latest: '1.1.0' },
    });

    // no fetch when flag set to false
    expect(fetchCount).toBe(0);
  });

  it('should specify fetch depth when depth param is defined', async () => {
    repositoryFactory = new RepositoryFactory('single');
    repo = repositoryFactory.cloneRepository();

    const options = getOptions({
      depth: 10,
    });

    generateChangeFiles(['foo'], options);

    repo.push();

    let fetchCommand: string = '';

    addGitObserver(args => {
      if (args[0] === 'fetch') {
        fetchCommand = args.join(' ');
      }
    });

    await publish(options);

    expect(await npmShow('foo')).toMatchObject({
      name: 'foo',
      versions: ['1.1.0'],
      'dist-tags': { latest: '1.1.0' },
    });

    expect(fetchCommand).toMatch('--depth=10');
  });

  it('calls precommit hook before committing changes', async () => {
    repositoryFactory = new RepositoryFactory('monorepo');
    repo = repositoryFactory.cloneRepository();

    const options = getOptions({
      hooks: {
        precommit: async cwd => {
          await new Promise(resolve => {
            fs.writeFile(path.resolve(cwd, 'foo.txt'), 'foo', resolve);
          });
        },
      },
    });

    generateChangeFiles(['foo'], options);
    repo.push();

    await publish(options);

    repo.checkout(defaultBranchName);
    repo.pull();

    // All git results should still have previous information
    expect(repo.getCurrentTags()).toEqual(['foo_v1.1.0']);
    const manifestJson = fs.readFileSync(repo.pathTo('foo.txt'));
    expect(manifestJson.toString()).toEqual('foo');
  });

  it('publishes multiple packages concurrently respecting the concurrency limit', async () => {
    const packagesToPublish = ['pkg1', 'pkg2', 'pkg3', 'pkg4', 'pkg5', 'pkg6', 'pkg7', 'pkg8', 'pkg9'];
    const packages: { [packageName: string]: PackageJsonFixture } = {};
    for (const name of packagesToPublish) {
      packages[name] = { version: '1.0.0' };
    }

    repositoryFactory = new RepositoryFactory({
      folders: {
        packages: packages,
      },
    });
    repo = repositoryFactory.cloneRepository();

    const concurrency = 2;
    const options = getOptions({ concurrency });

    generateChangeFiles(packagesToPublish, options);
    repo.push();

    const simulateWait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    let currentConcurrency = 0;
    let maxConcurrency = 0;
    npmMock.setCommandOverride('publish', async (registryData, args, opts) => {
      currentConcurrency++;
      await simulateWait(100);
      const result = await _mockNpmPublish(registryData, args, opts);
      maxConcurrency = Math.max(maxConcurrency, currentConcurrency);
      currentConcurrency--;
      return result;
    });

    await publish(options);
    // Verify that at most `concurrency` number of packages were published concurrently
    expect(maxConcurrency).toBe(concurrency);

    // Verify all packages were published
    for (const pkg of packagesToPublish) {
      expect(await npmShow(pkg)).toMatchObject({
        name: pkg,
        versions: ['1.1.0'],
        'dist-tags': { latest: '1.1.0' },
      });
    }

    repo.checkout(defaultBranchName);
    repo.pull();
    const expectedTags = packagesToPublish.map(pkg => `${pkg}_v1.1.0`);
    // Verify all tags were updated
    expect(repo.getCurrentTags().sort()).toEqual(expectedTags.sort());
  });

  it('handles errors correctly when one of the packages fails during concurrent publishing', async () => {
    logs.setOverrideOptions({ alsoLog: [] });
    const packageNames = ['pkg1', 'pkg2', 'pkg3', 'pkg4', 'pkg5', 'pkg6', 'pkg7', 'pkg8'];
    const packages: { [packageName: string]: PackageJsonFixture } = {};
    const packageToFail = 'pkg4';
    for (const name of packageNames) {
      packages[name] = { version: '1.0.0' };
    }
    packages['pkg8'].dependencies = { [packageToFail]: '1.0.0' };
    packages['pkg7'].dependencies = { [packageToFail]: '1.0.0' };

    repositoryFactory = new RepositoryFactory({
      folders: {
        packages: packages,
      },
    });
    repo = repositoryFactory.cloneRepository();

    const options = getOptions({ concurrency: 3 });

    generateChangeFiles(packageNames, options);
    repo.push();

    npmMock.setCommandOverride('publish', async (registryData, args, opts) => {
      if (opts.cwd?.endsWith(packageToFail)) {
        return {
          failed: true,
          stderr: 'Failed to publish package',
          stdout: '',
          success: false,
          all: 'Failed to publish package',
        };
      }
      return _mockNpmPublish(registryData, args, opts);
    });

    await expect(publish(options)).rejects.toThrow(
      'Error publishing! Refer to the previous logs for recovery instructions.'
    );

    for (const name of packageNames) {
      if (['pkg7', 'pkg8', packageToFail].includes(name)) {
        // Verify that the packages that failed to publish are not published
        // pkg7 and pkg8 are not published because they depend on pkg4 and pkg4 failed to publish
        await npmShow(name, { shouldFail: true });
      } else {
        // Verify that the packages that did not fail to publish are published
        expect(await npmShow(name)).toMatchObject({
          name: name,
          versions: ['1.1.0'],
          'dist-tags': { latest: '1.1.0' },
        });
      }
    }
  });

  it('should respect postpublish hook respecting the concurrency limit when publishing multiple packages concurrently', async () => {
    const packagesToPublish = ['pkg1', 'pkg2', 'pkg3', 'pkg4', 'pkg5', 'pkg6', 'pkg7', 'pkg8', 'pkg9'];
    type ExtraPackageJsonFixture = PackageJsonFixture & { afterPublish?: { notify: string } };
    const packages: { [packageName: string]: ExtraPackageJsonFixture } = {};
    for (const name of packagesToPublish) {
      packages[name] = {
        version: '1.0.0',
        afterPublish: {
          notify: `message-${name}`,
        },
      };
    }

    repositoryFactory = new RepositoryFactory({
      folders: {
        packages: packages,
      },
    });
    repo = repositoryFactory.cloneRepository();

    const simulateWait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const afterPublishStrings: { packageName: string; notify: string }[] = [];
    const concurrency = 2;
    let currentConcurrency = 0;
    let maxConcurrency = 0;
    const options = getOptions({
      hooks: {
        postpublish: async packagePath => {
          currentConcurrency++;
          await simulateWait(100);
          const packageName = path.basename(packagePath);
          const packageJsonPath = path.join(packagePath, 'package.json');
          const packageJson = fs.readJSONSync(packageJsonPath) as ExtraPackageJsonFixture;
          if (packageJson.afterPublish) {
            afterPublishStrings.push({
              packageName,
              notify: packageJson.afterPublish.notify,
            });
          }
          maxConcurrency = Math.max(maxConcurrency, currentConcurrency);
          currentConcurrency--;
        },
      },
      concurrency: concurrency,
    });

    generateChangeFiles(packagesToPublish, options);
    repo.push();

    await publish(options);
    // Verify that at most `concurrency` number of postpublish hooks were running concurrently
    expect(maxConcurrency).toBe(concurrency);

    for (const pkg of packagesToPublish) {
      const packageJson = fs.readJSONSync(repo.pathTo(`packages/${pkg}/package.json`)) as ExtraPackageJsonFixture;
      if (packageJson.afterPublish) {
        // Verify that all postpublish hooks were called
        expect(afterPublishStrings).toContainEqual({
          packageName: pkg,
          notify: packageJson.afterPublish.notify,
        });
      }
    }
  });
});
