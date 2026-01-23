import { describe, expect, it, afterEach, jest } from '@jest/globals';
import fs from 'fs';
import { defaultRemoteBranchName } from '../__fixtures__/gitDefaults';
import { generateChangeFiles } from '../__fixtures__/changeFiles';
import { initMockLogs } from '../__fixtures__/mockLogs';
import type { Repository } from '../__fixtures__/repository';
import { RepositoryFactory } from '../__fixtures__/repositoryFactory';
import { publish } from '../commands/publish';
import type { ParsedOptions, RepoOptions } from '../types/BeachballOptions';
import { initNpmMock } from '../__fixtures__/mockNpm';
import { removeTempDir, tmpdir } from '../__fixtures__/tmpdir';
import { getParsedOptions } from '../options/getOptions';
import { createCommandContext } from '../monorepo/createCommandContext';
import { validate } from '../validation/validate';
import { deepFreezeProperties } from '../__fixtures__/object';

// Spawning actual npm to run commands against a fake registry is extremely slow, so mock it for
// this test (packagePublish covers the more complete npm registry scenario).
//
// If an issue is found in the future that could only be caught by this test using real npm,
// a new test file with a real registry should be created to cover that specific scenario.
jest.mock('../packageManager/npm');
// jest.mock('npm-registry-fetch');

describe('publish command (registry)', () => {
  const npmMock = initNpmMock();

  let repositoryFactory: RepositoryFactory | undefined;
  let repo: Repository | undefined;
  let packToPath: string | undefined;

  const logs = initMockLogs();

  /**
   * Get options with defaults including skipping git stuff
   */
  function getOptions(repoOptions?: Partial<RepoOptions>) {
    const parsedOptions = getParsedOptions({
      cwd: repo!.rootPath,
      argv: ['node', 'beachball', 'publish', '--yes'],
      testRepoOptions: {
        branch: defaultRemoteBranchName,
        registry: 'fake',
        message: 'apply package updates',
        fetch: false,
        bumpDeps: false,
        push: false,
        gitTags: false,
        tag: 'latest',
        access: 'public',
        ...repoOptions,
      },
    });
    return { options: parsedOptions.options, parsedOptions };
  }

  /**
   * For more realistic testing, call `validate()` like the CLI command does, then call `publish()`.
   * This helps catch any new issues with double bumps or context mutation.
   */
  async function publishWrapper(parsedOptions: ParsedOptions) {
    logs.clear();
    // This does an initial bump
    const { context } = validate(parsedOptions, { checkDependencies: true });
    // Ensure the later bump process does not modify the context
    deepFreezeProperties(context.bumpInfo);
    deepFreezeProperties(context.originalPackageInfos);
    await publish(parsedOptions.options, context);
  }

  afterEach(() => {
    repositoryFactory?.cleanUp();
    repositoryFactory = undefined;
    repo = undefined;
    packToPath && removeTempDir(packToPath);
    packToPath = undefined;
  });

  it('packs single package', async () => {
    repositoryFactory = new RepositoryFactory('single');
    repo = repositoryFactory.cloneRepository();
    packToPath = tmpdir({ prefix: 'beachball-pack-' });

    const { options, parsedOptions } = getOptions({ packToPath });
    generateChangeFiles(['foo'], options);
    await publishWrapper(parsedOptions);

    expect(fs.readdirSync(packToPath)).toEqual(['1-foo-1.1.0.tgz']);
    expect(npmMock.getPublishedVersions('foo')).toBeUndefined();
    expect(logs.mocks.error).not.toHaveBeenCalled();
  });

  it('skips publishing private package with change file', async () => {
    repositoryFactory = new RepositoryFactory({
      folders: {
        packages: {
          foopkg: { version: '1.0.0', private: true },
          publicpkg: { version: '1.0.0' },
        },
      },
    });
    repo = repositoryFactory.cloneRepository();

    const { options, parsedOptions } = getOptions();
    generateChangeFiles(['foopkg'], options);

    // If there's only the private package with a change file, nothing happens
    await publishWrapper(parsedOptions);
    expect(logs.mocks.log).toHaveBeenCalledWith('Nothing to bump, skipping publish!');
    expect(logs.mocks.warn).toHaveBeenCalledWith(expect.stringContaining('Change detected for private package foopkg'));
    expect(logs.mocks.error).not.toHaveBeenCalled();
    expect(npmMock.getPublishedVersions('foopkg')).toBeUndefined();

    // Now try with a public package change file
    logs.clear();
    generateChangeFiles(['publicpkg'], options);
    await publishWrapper(parsedOptions);
    // Should be published despite private package change also existing
    expect(npmMock.getPublishedPackage('publicpkg')!.version).toEqual('1.1.0');
    // This is also a good case to get a "visual regression" test of the logs
    expect(logs.getMockLines('all', { root: repo.rootPath, sanitize: true })).toMatchInlineSnapshot(`
      "[log]
      Validating options and change files...
      [warn] Change detected for private package foopkg; delete this file: <root>/change/foopkg-<guid>.json
      [log]
      Validating package dependencies...
      [log] Validating no private package among package dependencies
      [log]   OK!

      [log]
      [log]
      Preparing to publish
      [log]
      Publishing with the following configuration:

        registry: fake

        current branch: master
        current hash: <commit>
        target branch: origin/master
        npm dist-tag: latest

        bumps versions before publishing: yes
        publishes to npm registry: yes
        pushes bumps and changelogs to remote git repo: no


      [log] Creating temporary publish branch publish_<timestamp>
      [log]
      Bumping versions and publishing packages to npm registry

      [log] Removing change files:
      [log] - publicpkg-<guid>.json
      [log]
      Validating new package versions...
      [log]
      Package versions are OK to publish:
        • publicpkg@1.1.0
      [log] Validating no private package among package dependencies
      [log]   OK!

      [log]
      Publishing - publicpkg@1.1.0 with tag latest
      [log]   publish command: publish --registry fake --tag latest --loglevel warn
      [log]   (cwd: <root>/packages/publicpkg)
      [log] Published! - publicpkg@1.1.0
      [log]
      [log] Skipping git push and tagging
      [log]
      Cleaning up
      [log] git checkout master
      [log] deleting temporary publish branch publish_<timestamp>"
    `);
  });

  it('publishes multiple changed packages', async () => {
    repositoryFactory = new RepositoryFactory('monorepo');
    repo = repositoryFactory.cloneRepository();
    // Simulate the current package versions already existing to test validatePackageVersions
    npmMock.publishPackage(repositoryFactory.fixture.folders.packages.foo);
    npmMock.publishPackage(repositoryFactory.fixture.folders.packages.bar);
    npmMock.publishPackage(repositoryFactory.fixture.folders.packages.baz);

    const { options, parsedOptions } = getOptions();
    generateChangeFiles(['foo', 'bar'], options);

    await publishWrapper(parsedOptions);

    expect(npmMock.getPublishedPackage('foo')!.version).toEqual('1.1.0');
    expect(npmMock.getPublishedPackage('bar')!.version).toEqual('1.4.0');
    expect(npmMock.mock).toHaveBeenCalledTimes(4);
    // expect(npmMock.mock).toHaveBeenCalledTimes(2);
    expect(logs.mocks.error).not.toHaveBeenCalled();
  });

  it('packs many packages', async () => {
    const packageNames = Array.from({ length: 11 }, (_, i) => `pkg-${i + 1}`);
    repositoryFactory = new RepositoryFactory({
      folders: {
        packages: Object.fromEntries(
          packageNames.map((name, i) => [
            name,
            // Each package depends on the next one, so they must be published in reverse alphabetical order
            { version: '1.0.0', dependencies: { [packageNames[i + 1] || 'other']: '^1.0.0' } },
          ])
        ),
      },
    });
    repo = repositoryFactory.cloneRepository();
    packToPath = tmpdir({ prefix: 'beachball-pack-' });

    const { options, parsedOptions } = getOptions({ packToPath, groupChanges: true });
    generateChangeFiles(packageNames, options);
    // initial validate() isn't relevant here
    await publish(options, createCommandContext(parsedOptions));

    expect(fs.readdirSync(packToPath).sort()).toEqual(
      [...packageNames].reverse().map((name, i) => `${String(i + 1).padStart(2, '0')}-${name}-1.1.0.tgz`)
    );
    expect(npmMock.getPublishedVersions('pkg-1')).toBeUndefined();
    expect(logs.mocks.error).not.toHaveBeenCalled();
  });

  it('exits publishing early if only invalid change files exist', async () => {
    repositoryFactory = new RepositoryFactory('monorepo');
    repo = repositoryFactory.cloneRepository();

    repo.updateJsonFile('packages/bar/package.json', { private: true });

    const { options, parsedOptions } = getOptions();
    generateChangeFiles(['bar', 'fake'], options);

    // initial validate() isn't relevant here
    await publish(options, createCommandContext(parsedOptions));

    expect(logs.mocks.log).toHaveBeenCalledWith('Nothing to bump, skipping publish!');
    expect(logs.mocks.warn).toHaveBeenCalledWith(expect.stringContaining('Change detected for private package bar'));
    expect(logs.mocks.warn).toHaveBeenCalledWith(
      expect.stringContaining('Change detected for nonexistent package fake')
    );
    expect(logs.mocks.error).not.toHaveBeenCalled();

    expect(npmMock.getPublishedVersions('foo')).toBeUndefined();
  });

  it('errors if version already exists in registry', async () => {
    repositoryFactory = new RepositoryFactory('monorepo');
    repo = repositoryFactory.cloneRepository();
    // Simulate the current package versions already existing to test validatePackageVersions
    npmMock.publishPackage(repositoryFactory.fixture.folders.packages.foo);
    npmMock.publishPackage(repositoryFactory.fixture.folders.packages.bar);
    npmMock.publishPackage(repositoryFactory.fixture.folders.packages.baz);
    // also say the bumped version of foo and bar already exist (baz is fine)
    npmMock.publishPackage({ ...repositoryFactory.fixture.folders.packages.foo, version: '1.1.0' });
    npmMock.publishPackage({ ...repositoryFactory.fixture.folders.packages.bar, version: '1.4.0' });

    const { options, parsedOptions } = getOptions();
    generateChangeFiles(['foo', 'bar', 'baz'], options);
    await expect(() => publishWrapper(parsedOptions)).rejects.toThrow('process.exit');

    expect(logs.getMockLines('error')).toMatchInlineSnapshot(`
      "ERROR: Attempting to publish package versions that already exist in the registry:
        • bar@1.4.0
        • foo@1.1.0
      Something went wrong with publishing! Manually update these package and versions:
        • bar@1.4.0
        • baz@1.4.0
        • foo@1.1.0
      No packages were published due to validation errors (see above for details)."
    `);
  });
});
