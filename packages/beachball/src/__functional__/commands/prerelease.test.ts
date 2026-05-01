import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { generateChangeFiles } from '../../__fixtures__/changeFiles';
import { defaultRemoteBranchName } from '../../__fixtures__/gitDefaults';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import type { Repository } from '../../__fixtures__/repository';
import { RepositoryFactory } from '../../__fixtures__/repositoryFactory';
import { prerelease } from '../../commands/prerelease';
import { createCommandContext } from '../../monorepo/createCommandContext';
import { getParsedOptions } from '../../options/getOptions';
import { listPackageVersions } from '../../packageManager/listPackageVersions';
import { publishToRegistry } from '../../publish/publishToRegistry';
import type { RepoOptions } from '../../types/BeachballOptions';
import { performBump } from '../../bump/performBump';

//
// These tests focus on the prerelease command. listPackageVersions, publishToRegistry, and
// performBump are mocked so the tests don't hit the network or write to the filesystem.
//
jest.mock('../../packageManager/listPackageVersions');
jest.mock('../../publish/publishToRegistry');
jest.mock('../../bump/performBump');

describe('prerelease command', () => {
  initMockLogs({ mockBeforeEach: true });

  const mockListPackageVersions = listPackageVersions as jest.MockedFunction<typeof listPackageVersions>;
  const mockPublishToRegistry = publishToRegistry as jest.MockedFunction<typeof publishToRegistry>;
  const mockPerformBump = performBump as jest.MockedFunction<typeof performBump>;

  let singleRepoFactory: RepositoryFactory;
  let repo: Repository | undefined;

  function getOptionsForPrerelease(repoOptions?: Partial<RepoOptions>) {
    const parsedOptions = getParsedOptions({
      cwd: repo!.rootPath,
      argv: ['node', 'beachball', 'prerelease', '--yes'],
      env: {},
      testRepoOptions: {
        branch: defaultRemoteBranchName,
        registry: 'fake',
        fetch: false,
        push: false,
        gitTags: false,
        access: 'public',
        ...repoOptions,
      },
    });
    return parsedOptions.options;
  }

  beforeAll(() => {
    singleRepoFactory = new RepositoryFactory('single');
  });

  beforeEach(() => {
    mockListPackageVersions.mockImplementation(() => Promise.resolve({}));
    mockPublishToRegistry.mockImplementation(() => Promise.resolve());
    mockPerformBump.mockImplementation(() => Promise.resolve());
  });

  afterEach(() => {
    jest.resetAllMocks();
    repo = undefined;
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('computes prerelease version using the default prefix and identifierBase', async () => {
    repo = singleRepoFactory.cloneRepository();
    const options = getOptionsForPrerelease();
    generateChangeFiles([{ packageName: 'foo', type: 'patch' }], options);

    // eslint-disable-next-line etc/no-deprecated -- test helper
    const context = createCommandContext(options);
    await prerelease(options, context);

    expect(mockPerformBump).toHaveBeenCalledTimes(1);
    const bumpInfo = mockPerformBump.mock.calls[0][0];
    expect(bumpInfo.packageInfos['foo'].version).toBe('1.0.1-prerelease.0');
  });

  it('uses the configured prereleasePrefix', async () => {
    repo = singleRepoFactory.cloneRepository();
    const options = getOptionsForPrerelease({ prereleasePrefix: 'beta' });
    generateChangeFiles([{ packageName: 'foo', type: 'patch' }], options);

    // eslint-disable-next-line etc/no-deprecated -- test helper
    const context = createCommandContext(options);
    await prerelease(options, context);

    const bumpInfo = mockPerformBump.mock.calls[0][0];
    expect(bumpInfo.packageInfos['foo'].version).toBe('1.0.1-beta.0');
  });

  it('strips the prerelease component from the current version (issue #676)', async () => {
    // 0.2.0 + minor change should produce 0.3.0-beta.0, not 0.2.1-beta.0.
    // This is the fix for https://github.com/microsoft/beachball/issues/676 issue 2.
    repo = singleRepoFactory.cloneRepository();
    const options = getOptionsForPrerelease({ prereleasePrefix: 'beta' });
    generateChangeFiles([{ packageName: 'foo', type: 'minor' }], options);

    // eslint-disable-next-line etc/no-deprecated -- test helper
    const context = createCommandContext(options);
    // Pretend foo is currently on a prerelease.
    context.originalPackageInfos['foo'].version = '0.2.0-beta.0';
    await prerelease(options, context);

    const bumpInfo = mockPerformBump.mock.calls[0][0];
    expect(bumpInfo.packageInfos['foo'].version).toBe('0.3.0-beta.0');
  });

  it('increments the counter when matching versions are already published', async () => {
    repo = singleRepoFactory.cloneRepository();
    const options = getOptionsForPrerelease({ prereleasePrefix: 'beta' });
    generateChangeFiles([{ packageName: 'foo', type: 'patch' }], options);

    mockListPackageVersions.mockImplementation(() => Promise.resolve({ foo: ['1.0.1-beta.0', '1.0.1-beta.1'] }));

    // eslint-disable-next-line etc/no-deprecated -- test helper
    const context = createCommandContext(options);
    await prerelease(options, context);

    const bumpInfo = mockPerformBump.mock.calls[0][0];
    expect(bumpInfo.packageInfos['foo'].version).toBe('1.0.1-beta.2');
  });

  it('respects identifierBase: "1"', async () => {
    repo = singleRepoFactory.cloneRepository();
    const options = getOptionsForPrerelease({
      prereleasePrefix: 'beta',
      identifierBase: '1',
    });
    generateChangeFiles([{ packageName: 'foo', type: 'patch' }], options);

    // eslint-disable-next-line etc/no-deprecated -- test helper
    const context = createCommandContext(options);
    await prerelease(options, context);

    const bumpInfo = mockPerformBump.mock.calls[0][0];
    expect(bumpInfo.packageInfos['foo'].version).toBe('1.0.1-beta.1');
  });

  it('respects identifierBase: false', async () => {
    repo = singleRepoFactory.cloneRepository();
    const options = getOptionsForPrerelease({
      prereleasePrefix: 'beta',
      identifierBase: false,
    });
    generateChangeFiles([{ packageName: 'foo', type: 'patch' }], options);

    // eslint-disable-next-line etc/no-deprecated -- test helper
    const context = createCommandContext(options);
    await prerelease(options, context);

    const bumpInfo = mockPerformBump.mock.calls[0][0];
    expect(bumpInfo.packageInfos['foo'].version).toBe('1.0.1-beta');
  });

  it('errors with identifierBase: false if the resulting version is already published', async () => {
    repo = singleRepoFactory.cloneRepository();
    const options = getOptionsForPrerelease({
      prereleasePrefix: 'beta',
      identifierBase: false,
    });
    generateChangeFiles([{ packageName: 'foo', type: 'patch' }], options);

    mockListPackageVersions.mockImplementation(() => Promise.resolve({ foo: ['1.0.1-beta'] }));

    // eslint-disable-next-line etc/no-deprecated -- test helper
    const context = createCommandContext(options);
    await expect(prerelease(options, context)).rejects.toThrow(/already exists/);
  });

  it('forces keepChangeFiles and disables changelog generation', async () => {
    repo = singleRepoFactory.cloneRepository();
    const options = getOptionsForPrerelease();
    generateChangeFiles([{ packageName: 'foo', type: 'patch' }], options);

    // eslint-disable-next-line etc/no-deprecated -- test helper
    const context = createCommandContext(options);
    await prerelease(options, context);

    expect(options.keepChangeFiles).toBe(true);
    expect(options.generateChangelog).toBe(false);
  });

  it('publishes to the registry when publish is true', async () => {
    repo = singleRepoFactory.cloneRepository();
    const options = getOptionsForPrerelease({ publish: true });
    generateChangeFiles([{ packageName: 'foo', type: 'patch' }], options);

    // eslint-disable-next-line etc/no-deprecated -- test helper
    const context = createCommandContext(options);
    await prerelease(options, context);

    expect(mockPublishToRegistry).toHaveBeenCalledTimes(1);
  });
});
