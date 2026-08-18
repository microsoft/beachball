import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as wsTools from 'workspace-tools';
import { getChange } from '../../__fixtures__/changeFiles';
import { makePackageInfos, type PartialPackageInfos } from '../../__fixtures__/packageInfos';
import { promptForChange } from '../../changefile/promptForChange';
import { writeChangeFiles } from '../../changefile/writeChangeFiles';
import { change } from '../../commands/change';
import { getOptions } from '../../options/getOptions';
import type { RepoOptions } from '../../types/BeachballOptions';
import type { ChangeCommandContext } from '../../types/CommandContext';

jest.mock('workspace-tools');
jest.mock('../../changefile/promptForChange');
jest.mock('../../changefile/writeChangeFiles');

describe('change command', () => {
  const wsToolsMocks = wsTools as jest.Mocked<typeof wsTools>;
  const mockPromptForChange = promptForChange as jest.MockedFunction<typeof promptForChange>;
  const mockWriteChangeFiles = writeChangeFiles as jest.MockedFunction<typeof writeChangeFiles>;

  async function getOptionsAndContext(
    params: {
      repoOptions?: Partial<RepoOptions>;
      packageInfos?: PartialPackageInfos;
      changedPackages?: string[];
    } = {}
  ) {
    const { repoOptions, packageInfos = { foo: {} }, changedPackages = Object.keys(packageInfos) } = params;
    const { options, cliOptions } = await getOptions({
      cwd: '',
      argv: ['node', 'beachball', 'change'],
      env: {},
      testRepoOptions: { branch: 'origin/main', ...repoOptions },
    });
    const originalPackageInfos = makePackageInfos(packageInfos, cliOptions);
    const context: ChangeCommandContext = {
      originalPackageInfos,
      packageGroups: {},
      scopedPackages: new Set(Object.keys(packageInfos)),
      changedPackages,
    };
    return { options, context };
  }

  beforeEach(() => {
    wsToolsMocks.getRecentCommitMessages.mockReturnValue(['commit message']);
    wsToolsMocks.getUserEmail.mockReturnValue('user@example.com');
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('returns early when no packages changed', async () => {
    const { options, context } = await getOptionsAndContext({ changedPackages: [] });

    await change(options, context);

    expect(wsToolsMocks.getRecentCommitMessages).not.toHaveBeenCalled();
    expect(wsToolsMocks.getUserEmail).not.toHaveBeenCalled();
    expect(mockPromptForChange).not.toHaveBeenCalled();
    expect(mockWriteChangeFiles).not.toHaveBeenCalled();
  });

  it('gets and includes email by default', async () => {
    const { options, context } = await getOptionsAndContext();

    await change(options, context);

    expect(wsToolsMocks.getRecentCommitMessages).toHaveBeenCalledWith({ branch: 'origin/main', cwd: '' });
    expect(wsToolsMocks.getUserEmail).toHaveBeenCalledWith({ cwd: '' });
    expect(mockPromptForChange).toHaveBeenCalledWith({
      changedPackages: ['foo'],
      packageInfos: context.originalPackageInfos,
      packageGroups: {},
      recentMessages: ['commit message'],
      email: 'user@example.com',
      options,
    });
  });

  it('does not get or include email when changeFile.includeEmail is false', async () => {
    const { options, context } = await getOptionsAndContext({
      repoOptions: { changeFile: { includeEmail: false } },
    });

    await change(options, context);

    expect(wsToolsMocks.getUserEmail).not.toHaveBeenCalled();
    expect(mockPromptForChange).toHaveBeenCalledWith({
      changedPackages: ['foo'],
      packageInfos: context.originalPackageInfos,
      packageGroups: {},
      recentMessages: ['commit message'],
      email: undefined,
      options,
    });
  });

  it('does not write change files if the prompt is canceled', async () => {
    const { options, context } = await getOptionsAndContext();
    mockPromptForChange.mockResolvedValue(undefined);

    await change(options, context);

    expect(mockWriteChangeFiles).not.toHaveBeenCalled();
  });

  it('writes changes with the default commit message', async () => {
    const { options, context } = await getOptionsAndContext();
    const changes = [getChange('foo')];
    mockPromptForChange.mockResolvedValue(changes);

    await change(options, context);

    expect(mockWriteChangeFiles).toHaveBeenCalledWith(changes, options, undefined);
  });

  it('resolves a custom commit message when writing changes', async () => {
    const commitMessage = jest.fn<NonNullable<RepoOptions['commitMessage']>>(() => 'custom commit message');
    const { options, context } = await getOptionsAndContext({ repoOptions: { commitMessage } });
    const changes = [getChange('foo')];
    mockPromptForChange.mockResolvedValue(changes);

    await change(options, context);

    expect(commitMessage).toHaveBeenCalledWith(options, context.originalPackageInfos);
    expect(mockWriteChangeFiles).toHaveBeenCalledWith(changes, options, 'custom commit message');
  });
});
