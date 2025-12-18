import { describe, expect, it, afterEach, jest } from '@jest/globals';
import { defaultRemoteBranchName } from '../__fixtures__/gitDefaults';
import { initMockLogs } from '../__fixtures__/mockLogs';
import type { Repository } from '../__fixtures__/repository';
import { RepositoryFactory } from '../__fixtures__/repositoryFactory';
import { sync, type SyncCommandContext } from '../commands/sync';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import type { packagePublish } from '../packageManager/packagePublish';
import type { RepoOptions } from '../types/BeachballOptions';
import { initNpmMock } from '../__fixtures__/mockNpm';
import { getParsedOptions } from '../options/getOptions';
import { removeTempDir } from '../__fixtures__/tmpdir';
import { getScopedPackages } from '../monorepo/getScopedPackages';

// Spawning actual npm to run commands against a fake registry is extremely slow, so mock it for
// this test (packagePublish covers the more complete npm registry scenario).
//
// If an issue is found in the future that could only be caught by this test using real npm,
// a new test file with a real registry should be created to cover that specific scenario.
jest.mock('../packageManager/npm');
jest.mock('npm-registry-fetch');

describe('sync command (e2e)', () => {
  const mockNpm = initNpmMock();
  initMockLogs();

  const tempDirs: string[] = [];
  let repositoryFactory: RepositoryFactory | undefined;
  let repo: Repository | undefined;

  const publishOptions: Parameters<typeof packagePublish>[1] = {
    registry: 'fake',
    retries: 3,
    path: undefined,
    npmReadConcurrency: 2,
  };

  function getOptionsAndContext(repoOptions?: Partial<RepoOptions>, extraArgv: string[] = []) {
    const parsedOptions = getParsedOptions({
      cwd: repo!.rootPath,
      argv: ['node', 'beachball', 'sync', ...extraArgv],
      testRepoOptions: {
        ...publishOptions,
        branch: defaultRemoteBranchName,
        publish: false,
        bumpDeps: false,
        push: false,
        gitTags: false,
        access: 'public',
        bump: false,
        generateChangelog: false,
        ...repoOptions,
      },
    });
    const originalPackageInfos = getPackageInfos(parsedOptions);
    const context: SyncCommandContext = {
      originalPackageInfos,
      scopedPackages: getScopedPackages(parsedOptions.options, originalPackageInfos),
    };
    return { options: parsedOptions.options, parsedOptions, context };
  }

  afterEach(() => {
    if (repositoryFactory) {
      repositoryFactory.cleanUp();
      repositoryFactory = undefined;
    }
    tempDirs.forEach(dir => removeTempDir(dir));
    tempDirs.splice(0, tempDirs.length);
  });

  it('can perform a successful sync', async () => {
    repositoryFactory = new RepositoryFactory({
      folders: {
        packages: {
          foopkg: { version: '1.0.0' },
          barpkg: { version: '2.2.0' },
          bazpkg: { version: '3.0.0' },
        },
      },
    });
    repo = repositoryFactory.cloneRepository();

    // publish initial package versions from the repo
    mockNpm.publishPackage(repositoryFactory.fixture.folders.packages.foopkg);
    mockNpm.publishPackage(repositoryFactory.fixture.folders.packages.barpkg);

    // publish newer out-of-sync package versions
    mockNpm.publishPackage({ name: 'foopkg', version: '1.2.0' });
    mockNpm.publishPackage({ name: 'barpkg', version: '3.0.0' });

    // sync repo to published versions
    const { options, parsedOptions, context } = getOptionsAndContext();
    await sync(options, context);

    const packageInfosAfterSync = getPackageInfos(parsedOptions);

    expect(packageInfosAfterSync['foopkg'].version).toEqual('1.2.0');
    expect(packageInfosAfterSync['barpkg'].version).toEqual('3.0.0');
    expect(packageInfosAfterSync['bazpkg'].version).toEqual('3.0.0');
  });

  it('can perform a successful sync using dist tag', async () => {
    repositoryFactory = new RepositoryFactory({
      folders: {
        packages: {
          apkg: { version: '1.0.0' },
          bpkg: { version: '2.2.0' },
          cpkg: { version: '3.0.0' },
        },
      },
    });
    repo = repositoryFactory.cloneRepository();

    // publish initial package versions from the repo
    mockNpm.publishPackage(repositoryFactory.fixture.folders.packages.apkg);
    mockNpm.publishPackage(repositoryFactory.fixture.folders.packages.bpkg);

    // publish newer out-of-sync package versions, one with a different tag
    mockNpm.publishPackage({ name: 'apkg', version: '2.0.0' }, 'beta');
    mockNpm.publishPackage({ name: 'bpkg', version: '3.0.0' });

    const { options, parsedOptions, context } = getOptionsAndContext({
      tag: 'beta',
    });
    await sync(options, context);

    const packageInfosAfterSync = getPackageInfos(parsedOptions);

    // apkg should be updated to the new beta tag; others should not be updated
    expect(packageInfosAfterSync['apkg'].version).toEqual('2.0.0');
    expect(packageInfosAfterSync['bpkg'].version).toEqual('2.2.0');
    expect(packageInfosAfterSync['cpkg'].version).toEqual('3.0.0');
  });

  it('can perform a successful sync by forcing dist tag version', async () => {
    repositoryFactory = new RepositoryFactory({
      folders: {
        packages: {
          epkg: { version: '1.0.0' },
          fpkg: { version: '2.2.0' },
          gpkg: { version: '3.0.0' },
        },
      },
    });
    repo = repositoryFactory.cloneRepository();

    // publish initial package versions from the repo
    mockNpm.publishPackage(repositoryFactory.fixture.folders.packages.epkg);
    mockNpm.publishPackage(repositoryFactory.fixture.folders.packages.fpkg);

    // publish newer out-of-sync package versions, one with a different tag
    mockNpm.publishPackage({ name: 'epkg', version: '1.0.0-1' }, 'prerelease');
    mockNpm.publishPackage({ name: 'fpkg', version: '3.0.0' });

    const { options, parsedOptions, context } = getOptionsAndContext({}, ['--tag', 'prerelease', '--force']);
    await sync(options, context);

    const packageInfosAfterSync = getPackageInfos(parsedOptions);

    expect(packageInfosAfterSync['epkg'].version).toEqual('1.0.0-1');
    expect(packageInfosAfterSync['fpkg'].version).toEqual('2.2.0');
    expect(packageInfosAfterSync['gpkg'].version).toEqual('3.0.0');
  });
});
