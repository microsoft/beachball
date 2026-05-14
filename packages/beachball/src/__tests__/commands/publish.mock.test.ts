import { afterAll, afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as wsTools from 'workspace-tools';
import { generateChangeSet } from '../../__fixtures__/changeFiles';
import { defaultBranchName, defaultRemoteBranchName } from '../../__fixtures__/gitDefaults';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { makePackageInfos, type PartialPackageInfos } from '../../__fixtures__/packageInfos';
import { publish } from '../../commands/publish';
import { getParsedOptions } from '../../options/getOptions';
import { bumpAndPush } from '../../publish/bumpAndPush';
import { publishToRegistry } from '../../publish/publishToRegistry';
import type { RepoOptions } from '../../types/BeachballOptions';
import type { BumpInfo } from '../../types/BumpInfo';
import type { CommandContext } from '../../types/CommandContext';

jest.mock('workspace-tools');
jest.mock('../../bump/bumpInMemory');
jest.mock('../../publish/bumpAndPush');
jest.mock('../../publish/publishToRegistry');

describe('publish command (all helpers mocked)', () => {
  // this test uses resetAllMocks, so mock the log methods in beforeEach
  const logs = initMockLogs({ mockBeforeEach: true });

  const mockPublishToRegistry = publishToRegistry as jest.MockedFunction<typeof publishToRegistry>;
  const mockBumpAndPush = bumpAndPush as jest.MockedFunction<typeof bumpAndPush>;
  const wsToolsMocks = wsTools as jest.Mocked<typeof wsTools>;
  const matchAny = expect.anything();
  const matchPublishBranch = expect.stringMatching(/^publish_\d+$/);
  const currentHash = 'abc123';

  /**
   * Get options and context. The context has a completely empty `bumpInfo`, but the `changeSet`
   * contains a change for each package (since it's looked at directly by logic within `publish()`).
   */
  function getOptionsAndContext(params: {
    /** bump, push, and publish are true by default */
    repoOptions?: Partial<RepoOptions>;
    packageInfos: PartialPackageInfos;
    context?: Partial<CommandContext>;
  }) {
    const { repoOptions, packageInfos, context: partialContext } = params;

    const parsedOptions = getParsedOptions({
      cwd: '',
      argv: ['node', 'beachball', 'publish', '--yes'],
      env: {},
      testRepoOptions: {
        branch: defaultRemoteBranchName,
        registry: 'fake',
        message: 'apply package updates',
        push: true,
        bump: true,
        publish: true,
        tag: 'latest',
        ...repoOptions,
      },
    });

    const context: CommandContext = {
      originalPackageInfos: makePackageInfos(packageInfos, parsedOptions.cliOptions),
      packageGroups: {},
      scopedPackages: new Set(Object.keys(packageInfos)),
      changeSet: generateChangeSet(Object.keys(packageInfos)),
      bumpInfo: {} as BumpInfo,
      ...partialContext,
    };

    return { options: parsedOptions.options, context };
  }

  beforeEach(() => {
    /* eslint-disable -- require-await, incorrect no-deprecated */
    mockPublishToRegistry.mockImplementation(async () => console.log('fake publishing\n'));
    mockBumpAndPush.mockImplementation(async () => console.log('fake bump and push\n'));
    wsToolsMocks.getBranchName.mockReturnValue(defaultBranchName);
    wsToolsMocks.getCurrentHash.mockReturnValue(currentHash);
    wsToolsMocks.git.mockReturnValue({ stdout: '', stderr: '', success: true } as wsTools.GitProcessOutput);
    /* eslint-enable */
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('returns early when there are no change files', async () => {
    const { options, context } = getOptionsAndContext({
      packageInfos: { foo: {} },
      context: { changeSet: [] },
    });

    await publish(options, context);

    expect(mockPublishToRegistry).not.toHaveBeenCalled();
    expect(mockBumpAndPush).not.toHaveBeenCalled();

    expect(logs.getMockLines('all')).toMatchInlineSnapshot(`
      "[log] Preparing to publish

      [log] Nothing to bump - skipping publish!"
    `);
  });

  it('skips bumpAndPush when push is false', async () => {
    const { options, context } = getOptionsAndContext({
      repoOptions: { push: false },
      packageInfos: { foo: {} },
    });

    await publish(options, context);

    expect(mockPublishToRegistry).toHaveBeenCalledTimes(1);
    expect(mockBumpAndPush).not.toHaveBeenCalled();
    const logContent = logs.getMockLines('all');
    expect(logContent).toContain('bumps versions before publishing: yes');
    expect(logContent).toContain('pushes bumps and changelogs to remote git repo: no');
    expect(logContent).toContain('publishes to npm registry: yes');
    expect(logContent).toContain('Skipping git push and tagging');
  });

  it('skips bumpAndPush when bump is false', async () => {
    const { options, context } = getOptionsAndContext({
      repoOptions: { bump: false },
      packageInfos: { foo: {} },
    });

    await publish(options, context);

    expect(mockPublishToRegistry).toHaveBeenCalledTimes(1);
    expect(mockBumpAndPush).not.toHaveBeenCalled();
    const logContent = logs.getMockLines('all');
    expect(logContent).toContain('bumps versions before publishing: no');
    expect(logContent).toContain('pushes bumps and changelogs to remote git repo: no');
    expect(logContent).toContain('Skipping git push and tagging');
  });

  it('skips publishToRegistry when publish is false', async () => {
    const { options, context } = getOptionsAndContext({
      repoOptions: { publish: false },
      packageInfos: { foo: {} },
    });

    await publish(options, context);

    expect(mockPublishToRegistry).not.toHaveBeenCalled();
    expect(mockBumpAndPush).toHaveBeenCalledTimes(1);
    const logContent = logs.getMockLines('all');
    expect(logContent).toContain('publishes to npm registry: no');
    expect(logContent).toContain('bumps versions before publishing: yes');
    expect(logContent).toContain('Skipping publish');
  });

  it('calls publishToRegistry when packToPath is set even if publish is false', async () => {
    const { options, context } = getOptionsAndContext({
      repoOptions: { publish: false, packToPath: '/tmp/fake-pack' },
      packageInfos: { foo: {} },
    });

    await publish(options, context);

    expect(mockPublishToRegistry).toHaveBeenCalledTimes(1);
    expect(mockBumpAndPush).toHaveBeenCalledTimes(1);
    const logContent = logs.getMockLines('all');
    expect(logContent).toContain('packs to path instead of publishing to npm registry: /tmp/fake-pack');
    expect(logContent).toContain('bumps versions before packing: yes');
    expect(logContent).not.toContain('Skipping publish');
  });

  // This also needs to be covered by a test with real git
  it('returns to original branch and deletes publish branch after completion', async () => {
    const currentBranch = 'fake-branch';
    // eslint-disable-next-line @ms-cloudpack/no-deprecated
    wsToolsMocks.getBranchName.mockReturnValue(currentBranch);
    const { options, context } = getOptionsAndContext({
      packageInfos: { foo: {} },
    });

    await publish(options, context);

    expect(wsToolsMocks.gitFailFast).toHaveBeenNthCalledWith(1, ['checkout', '-b', matchPublishBranch], matchAny);
    expect(wsToolsMocks.gitFailFast).toHaveBeenLastCalledWith(['checkout', currentBranch], matchAny);
    expect(wsToolsMocks.git).toHaveBeenLastCalledWith(['branch', '-D', matchPublishBranch], matchAny);
  });

  it('returns to correct hash from detached HEAD', async () => {
    // eslint-disable-next-line @ms-cloudpack/no-deprecated
    wsToolsMocks.getBranchName.mockReturnValue('HEAD');

    const { options, context } = getOptionsAndContext({ packageInfos: { foo: {} } });

    await publish(options, context);

    expect(wsToolsMocks.gitFailFast).toHaveBeenNthCalledWith(1, ['checkout', '-b', matchPublishBranch], matchAny);
    expect(wsToolsMocks.gitFailFast).toHaveBeenLastCalledWith(['checkout', currentHash], matchAny);
    expect(wsToolsMocks.git).toHaveBeenLastCalledWith(['branch', '-D', matchPublishBranch], matchAny);
    expect(logs.mocks.log).toHaveBeenCalledWith('Looks like the repo was detached from a branch');
  });
});
