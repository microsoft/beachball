import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { getBranchName, getCurrentHash } from 'workspace-tools';
import { generateChangeFiles } from '../../__fixtures__/changeFiles';
import { defaultRemoteBranchName } from '../../__fixtures__/gitDefaults';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { deepFreezeProperties } from '../../__fixtures__/object';
import type { Repository } from '../../__fixtures__/repository';
import { RepositoryFactory } from '../../__fixtures__/repositoryFactory';
import { bumpInMemory } from '../../bump/bumpInMemory';
import { publish } from '../../commands/publish';
import { createCommandContext } from '../../monorepo/createCommandContext';
import { getParsedOptions } from '../../options/getOptions';
import { bumpAndPush } from '../../publish/bumpAndPush';
import { publishToRegistry } from '../../publish/publishToRegistry';
import type { ParsedOptions, RepoOptions } from '../../types/BeachballOptions';
import { validate } from '../../validation/validate';
import { getNewPackages } from '../../publish/getNewPackages';

//
// These tests focus on functionality of the publish() function itself, not its major helpers
// such as publishToRegistry or bumpAndPush, which have their own dedicated tests.
// Also, basics like logging and verifying which child functions are called per options should be
// covered in the unit test publish.mock.test.ts, since tests using git are more expensive.
//
jest.mock('../../publish/publishToRegistry');
jest.mock('../../publish/bumpAndPush');
jest.mock('../../publish/getNewPackages');

describe('publish command', () => {
  // this test uses resetAllMocks, so mock the log methods in beforeEach
  const logs = initMockLogs({ mockBeforeEach: true });

  const mockPublishToRegistry = publishToRegistry as jest.MockedFunction<typeof publishToRegistry>;
  const mockBumpAndPush = bumpAndPush as jest.MockedFunction<typeof bumpAndPush>;
  const mockGetNewPackages = getNewPackages as jest.MockedFunction<typeof getNewPackages>;

  // These tests reuse factories, so they must NOT actually push changes
  // (even if push is true, bumpAndPush is mocked)
  let singleRepoFactory: RepositoryFactory;
  let monorepoFactory: RepositoryFactory;
  let repo: Repository | undefined;

  function getOptions(repoOptions?: Partial<RepoOptions>) {
    const parsedOptions = getParsedOptions({
      cwd: repo!.rootPath,
      argv: ['node', 'beachball', 'publish', '--yes'],
      env: {},
      testRepoOptions: {
        branch: defaultRemoteBranchName,
        registry: 'fake',
        message: 'apply package updates',
        fetch: false,
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
    // This does an initial bump
    const { context } = validate(parsedOptions, { checkDependencies: true });
    // Ensure the later bump process does not modify the context
    deepFreezeProperties(context.bumpInfo);
    deepFreezeProperties(context.originalPackageInfos);
    await publish(parsedOptions.options, context);
    return context;
  }

  beforeAll(() => {
    singleRepoFactory = new RepositoryFactory('single');
    monorepoFactory = new RepositoryFactory('monorepo');
  });

  beforeEach(() => {
    mockPublishToRegistry.mockImplementation(() => Promise.resolve());
    mockBumpAndPush.mockImplementation(() => Promise.resolve());
    mockGetNewPackages.mockImplementation(() => Promise.resolve([]));
  });

  afterEach(() => {
    jest.resetAllMocks();
    repo = undefined;
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('bumps and pushes when enabled', async () => {
    repo = singleRepoFactory.cloneRepository();

    const { options, parsedOptions } = getOptions({ bump: true, push: true });
    generateChangeFiles(['foo'], options);
    logs.clear();

    await publishWrapper(parsedOptions);

    expect(mockPublishToRegistry).toHaveBeenCalledTimes(1);
    expect(mockBumpAndPush).toHaveBeenCalledTimes(1);

    // Verify bumpAndPush received a publish branch name and the options
    expect(mockBumpAndPush).toHaveBeenCalledWith(
      expect.objectContaining({ modifiedPackages: expect.any(Set) }),
      expect.stringMatching(/^publish_\d+$/),
      expect.objectContaining({ bump: true, push: true })
    );
  });

  it('calls publishToRegistry when packToPath is set even if publish is false', async () => {
    repo = singleRepoFactory.cloneRepository();

    const { options, parsedOptions } = getOptions({ publish: false, packToPath: '/tmp/fake-pack' });
    generateChangeFiles(['foo'], options);
    logs.clear();

    await publishWrapper(parsedOptions);

    expect(mockPublishToRegistry).toHaveBeenCalledTimes(1);
  });

  it('returns to original branch and deletes publish branch after completion', async () => {
    repo = singleRepoFactory.cloneRepository();

    const { options, parsedOptions } = getOptions();
    generateChangeFiles(['foo'], options);
    logs.clear();

    const branchBefore = getBranchName({ cwd: repo.rootPath });

    await publishWrapper(parsedOptions);

    expect(getBranchName({ cwd: repo.rootPath })).toBe(branchBefore);
    expect(repo.git(['branch']).stdout).not.toMatch(/publish_/);
  });

  it('returns to correct hash from detached HEAD', async () => {
    repo = singleRepoFactory.cloneRepository();

    const { options, parsedOptions } = getOptions();
    generateChangeFiles(['foo'], options);
    logs.clear();

    repo.checkout('--detach');
    const hashBefore = getCurrentHash({ cwd: repo.rootPath });

    await publishWrapper(parsedOptions);

    expect(getCurrentHash({ cwd: repo.rootPath })).toBe(hashBefore);
    expect(repo.git(['branch']).stdout).not.toMatch(/publish_/);
  });

  it('populates bumpInfo with correct change types', async () => {
    repo = singleRepoFactory.cloneRepository();

    const { options, parsedOptions } = getOptions();
    generateChangeFiles(['foo'], options);
    logs.clear();

    const context = createCommandContext(parsedOptions);
    expect(context.bumpInfo).toBeUndefined();

    await publish(options, context);

    expect(context.bumpInfo).toBeDefined();
    expect(context.bumpInfo!.calculatedChangeTypes).toHaveProperty('foo', 'minor');
    expect(context.bumpInfo!.modifiedPackages).toContain('foo');
    expect(context.bumpInfo!.packageInfos.foo.version).toBe('1.1.0');
  });

  it('passes correct bumpInfo to publishToRegistry in a monorepo', async () => {
    repo = monorepoFactory.cloneRepository();

    const { options, parsedOptions } = getOptions({ bumpDeps: true });
    // baz has a minor change; bar depends on baz, foo depends on bar
    generateChangeFiles(['baz'], options);
    logs.clear();

    await publishWrapper(parsedOptions);

    expect(mockPublishToRegistry).toHaveBeenCalledTimes(1);
    const bumpInfo = mockPublishToRegistry.mock.calls[0][0];

    expect(bumpInfo.calculatedChangeTypes.baz).toBe('minor');
    expect(bumpInfo.packageInfos.baz.version).toBe('1.4.0');

    expect(bumpInfo.calculatedChangeTypes.bar).toBe('patch');
    expect(bumpInfo.packageInfos.bar.version).toBe('1.3.5');

    expect(bumpInfo.calculatedChangeTypes.foo).toBe('patch');
    expect(bumpInfo.packageInfos.foo.version).toBe('1.0.1');

    expect(bumpInfo.modifiedPackages).toEqual(new Set(['foo', 'bar', 'baz']));
  });

  it('reuses pre-calculated bumpInfo from context', async () => {
    repo = singleRepoFactory.cloneRepository();

    const { options, parsedOptions } = getOptions();
    generateChangeFiles(['foo'], options);
    logs.clear();

    const context = createCommandContext(parsedOptions);
    context.bumpInfo = bumpInMemory(options, context);
    const originalBumpInfo = context.bumpInfo;

    await publish(options, context);

    // Should be the same object reference (not recalculated)
    expect(context.bumpInfo).toBe(originalBumpInfo);
    expect(mockPublishToRegistry.mock.calls[0][0]).toBe(originalBumpInfo);
  });

  it('logs expected output for a standard publish flow', async () => {
    repo = singleRepoFactory.cloneRepository();

    const { options, parsedOptions } = getOptions();
    generateChangeFiles(['foo'], options);
    logs.clear();

    await publishWrapper(parsedOptions);

    expect(logs.getMockLines('all', { root: repo.rootPath, sanitize: true })).toMatchSnapshot();
  });
});
