import { describe, expect, it, jest } from '@jest/globals';
import type prompts from 'prompts';
import { getQuestionsForPackage } from '../../changefile/getQuestionsForPackage';
import type { ChangeFilePromptOptions } from '../../types/ChangeFilePrompt';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { makePackageInfos, type PartialPackageInfo } from '../../__fixtures__/packageInfos';
import type { ChangeType } from '../../types/ChangeInfo';
import { getParsedOptions } from '../../options/getOptions';
import type { PackageGroups } from '../../types/PackageInfo';

type GetQuestionsParams = Parameters<typeof getQuestionsForPackage>[0];

/**
 * This covers the first part of `promptForChange`: determining what questions to ask for each package.
 */
describe('getQuestionsForPackage', () => {
  /** Package name used in the tests */
  const pkg = 'foo';

  const logs = initMockLogs();

  function getQuestionsWrapper(
    params: {
      options?: Partial<GetQuestionsParams['options']>;
      packageInfo?: PartialPackageInfo;
      // slight difference from real scenario: pass groups directly, not derived from options
      packageGroups?: PackageGroups;
      recentMessages?: string[];
    } = {}
  ) {
    const { options: repoOptions = {}, packageInfo = {}, packageGroups = {}, recentMessages = ['message'] } = params;

    const packageInfos = makePackageInfos({ [pkg]: packageInfo });
    // fill in default options
    const { options } = getParsedOptions({ cwd: '', argv: [], testRepoOptions: repoOptions });

    return getQuestionsForPackage({ pkg, packageInfos, packageGroups, options, recentMessages });
  }

  it('works in basic case', () => {
    const questions = getQuestionsWrapper();
    expect(questions).toEqual([
      {
        choices: [
          { title: expect.stringContaining('Patch'), value: 'patch' },
          { title: expect.stringContaining('Minor'), value: 'minor' },
          { title: expect.stringContaining('None'), value: 'none' },
          { title: expect.stringContaining('Major'), value: 'major' },
        ],
        message: 'Change type',
        name: 'type',
        type: 'select',
      },
      {
        choices: [{ title: 'message' }],
        message: 'Describe changes (type or choose one)',
        name: 'comment',
        onState: expect.any(Function),
        suggest: expect.any(Function),
        type: 'autocomplete',
      },
    ]);
  });

  // it's somewhat debatable if this is correct (maybe --type should be the override for disallowedChangeTypes?)
  it('errors if options.type is disallowed', () => {
    const questions = getQuestionsWrapper({
      packageInfo: { beachball: { disallowedChangeTypes: ['major'] } },
      options: { type: 'major', message: '' },
    });
    expect(questions).toBeUndefined();
    expect(logs.mocks.error).toHaveBeenCalledWith('Change type "major" is not allowed for package "foo"');
  });

  it('errors if there are no valid change types for package', () => {
    const questions = getQuestionsWrapper({
      packageInfo: { beachball: { disallowedChangeTypes: ['major', 'minor', 'patch', 'none'] } },
    });
    expect(questions).toBeUndefined();
    expect(logs.mocks.error).toHaveBeenCalledWith('No valid change types available for package "foo"');
  });

  it('respects disallowedChangeTypes', () => {
    const questions = getQuestionsWrapper({
      packageInfo: { beachball: { disallowedChangeTypes: ['major'] } },
    });
    const choices = (questions![0].choices as prompts.Choice[]).map(c => c.value as ChangeType);
    expect(choices).toEqual(['patch', 'minor', 'none']);
  });

  it('allows prerelease change for package with prerelease version', () => {
    const questions = getQuestionsWrapper({
      packageInfo: { version: '1.0.0-beta.1' },
    });
    const choices = (questions![0].choices as prompts.Choice[]).map(c => c.value as ChangeType);
    expect(choices).toEqual(['prerelease', 'patch', 'minor', 'none', 'major']);
  });

  // this is a bit weird as well, but documenting current behavior
  it('excludes prerelease if disallowed', () => {
    const questions = getQuestionsWrapper({
      packageInfo: { version: '1.0.0-beta.1', beachball: { disallowedChangeTypes: ['prerelease'] } },
    });
    const choices = (questions![0].choices as prompts.Choice[]).map(c => c.value as ChangeType);
    expect(choices).toEqual(['patch', 'minor', 'none', 'major']);
  });

  it('excludes the change type question when options.type is specified', () => {
    const questions = getQuestionsWrapper({
      options: { type: 'patch', message: '' },
    });
    expect(questions).toHaveLength(1);
    expect(questions![0].name).toBe('comment');
  });

  it('excludes the change type question with only one valid option', () => {
    const questions = getQuestionsWrapper({
      packageInfo: { beachball: { disallowedChangeTypes: ['major', 'minor', 'none'] } },
    });
    expect(questions).toHaveLength(1);
    expect(questions![0].name).toBe('comment');
  });

  it('excludes the change type question when prerelease is implicitly the only valid option', () => {
    const questions = getQuestionsWrapper({
      packageInfo: {
        version: '1.0.0-beta.1',
        beachball: { disallowedChangeTypes: ['major', 'minor', 'patch', 'none'] },
      },
    });
    expect(questions).toHaveLength(1);
    expect(questions![0].name).toBe('comment');
  });

  it('excludes the comment question when options.message is set', () => {
    const questions = getQuestionsWrapper({
      options: { message: 'message' },
    });
    expect(questions).toHaveLength(1);
    expect(questions![0].name).toBe('type');
  });

  it('uses options.changeFilePrompt if set', () => {
    const customQuestions: prompts.PromptObject[] = [{ name: 'custom', message: 'custom prompt', type: 'text' }];
    const changePrompt: ChangeFilePromptOptions['changePrompt'] = jest.fn(() => customQuestions);

    const questions = getQuestionsWrapper({
      options: { changeFilePrompt: { changePrompt } },
    });

    expect(questions).toEqual(customQuestions);
    // includes the original prompts as parameters
    expect(changePrompt).toHaveBeenLastCalledWith(
      {
        changeType: expect.objectContaining({ name: 'type' }),
        description: expect.objectContaining({ name: 'comment' }),
      },
      pkg
    );
  });

  it('does case-insensitive filtering on description suggestions', async () => {
    const recentMessages = ['Foo', 'Bar', 'Baz'];
    const recentMessageChoices = [{ title: 'Foo' }, { title: 'Bar' }, { title: 'Baz' }];
    const questions = getQuestionsWrapper({ recentMessages });
    expect(questions).toEqual([
      expect.anything(),
      expect.objectContaining({
        name: 'comment',
        choices: recentMessageChoices,
        suggest: expect.any(Function),
      }),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const suggestions = await questions![1].suggest!('ba', recentMessageChoices);
    expect(suggestions).toEqual([{ title: 'Bar' }, { title: 'Baz' }]);
  });
});
