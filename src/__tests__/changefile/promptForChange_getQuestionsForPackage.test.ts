import { describe, expect, it, jest } from '@jest/globals';
import prompts from 'prompts';
import { _getQuestionsForPackage } from '../../changefile/promptForChange';
import { BeachballOptions } from '../../types/BeachballOptions';
import { ChangeFilePromptOptions } from '../../types/ChangeFilePrompt';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { makePackageInfos } from '../../__fixtures__/packageInfos';

/**
 * This covers the first part of `promptForChange`: determining what questions to ask for each package.
 */
describe('promptForChange _getQuestionsForPackage', () => {
  /** Package name used in the tests */
  const pkg = 'foo';

  /** Basic params for `_getQuestionsForPackage`, for a package named `foo` */
  const defaultQuestionsParams: Parameters<typeof _getQuestionsForPackage>[0] = {
    pkg,
    packageInfos: makePackageInfos({ [pkg]: {} }),
    packageGroups: {},
    options: {} as BeachballOptions,
    recentMessages: ['message'],
  };

  const logs = initMockLogs();

  it('works in basic case', () => {
    const questions = _getQuestionsForPackage(defaultQuestionsParams);
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
    const questions = _getQuestionsForPackage({
      ...defaultQuestionsParams,
      packageInfos: makePackageInfos({ [pkg]: { combinedOptions: { disallowedChangeTypes: ['major'] } } }),
      options: { type: 'major' } as BeachballOptions,
    });
    expect(questions).toBeUndefined();
    expect(logs.mocks.error).toHaveBeenCalledWith('Change type "major" is not allowed for package "foo"');
  });

  it('errors if there are no valid change types for package', () => {
    const questions = _getQuestionsForPackage({
      ...defaultQuestionsParams,
      packageInfos: makePackageInfos({
        [pkg]: { combinedOptions: { disallowedChangeTypes: ['major', 'minor', 'patch', 'none'] } },
      }),
    });
    expect(questions).toBeUndefined();
    expect(logs.mocks.error).toHaveBeenCalledWith('No valid change types available for package "foo"');
  });

  it('respects disallowedChangeTypes', () => {
    const questions = _getQuestionsForPackage({
      ...defaultQuestionsParams,
      packageInfos: makePackageInfos({ [pkg]: { combinedOptions: { disallowedChangeTypes: ['major'] } } }),
    });
    const choices = (questions![0].choices as prompts.Choice[]).map(c => c.value);
    expect(choices).toEqual(['patch', 'minor', 'none']);
  });

  it('allows prerelease change for package with prerelease version', () => {
    const questions = _getQuestionsForPackage({
      ...defaultQuestionsParams,
      packageInfos: makePackageInfos({ [pkg]: { version: '1.0.0-beta.1' } }),
    });
    const choices = (questions![0].choices as prompts.Choice[]).map(c => c.value);
    expect(choices).toEqual(['prerelease', 'patch', 'minor', 'none', 'major']);
  });

  // this is a bit weird as well, but documenting current behavior
  it('excludes prerelease if disallowed', () => {
    const questions = _getQuestionsForPackage({
      ...defaultQuestionsParams,
      packageInfos: makePackageInfos({
        [pkg]: { version: '1.0.0-beta.1', combinedOptions: { disallowedChangeTypes: ['prerelease'] } },
      }),
    });
    const choices = (questions![0].choices as prompts.Choice[]).map(c => c.value);
    expect(choices).toEqual(['patch', 'minor', 'none', 'major']);
  });

  it('excludes the change type question when options.type is specified', () => {
    const questions = _getQuestionsForPackage({
      ...defaultQuestionsParams,
      options: { type: 'patch' } as BeachballOptions,
    });
    expect(questions).toHaveLength(1);
    expect(questions![0].name).toBe('comment');
  });

  it('excludes the change type question with only one valid option', () => {
    const questions = _getQuestionsForPackage({
      ...defaultQuestionsParams,
      packageInfos: makePackageInfos({
        [pkg]: { combinedOptions: { disallowedChangeTypes: ['major', 'minor', 'none'] } },
      }),
    });
    expect(questions).toHaveLength(1);
    expect(questions![0].name).toBe('comment');
  });

  it('excludes the change type question when prerelease is implicitly the only valid option', () => {
    const questions = _getQuestionsForPackage({
      ...defaultQuestionsParams,
      packageInfos: makePackageInfos({
        [pkg]: {
          version: '1.0.0-beta.1',
          combinedOptions: { disallowedChangeTypes: ['major', 'minor', 'patch', 'none'] },
        },
      }),
    });
    expect(questions).toHaveLength(1);
    expect(questions![0].name).toBe('comment');
  });

  it('excludes the comment question when options.message is set', () => {
    const questions = _getQuestionsForPackage({
      ...defaultQuestionsParams,
      options: { message: 'message' } as BeachballOptions,
    });
    expect(questions).toHaveLength(1);
    expect(questions![0].name).toBe('type');
  });

  it('uses options.changeFilePrompt if set', () => {
    const customQuestions: prompts.PromptObject[] = [{ name: 'custom', message: 'custom prompt', type: 'text' }];
    const changePrompt: ChangeFilePromptOptions['changePrompt'] = jest.fn(() => customQuestions);

    const questions = _getQuestionsForPackage({
      ...defaultQuestionsParams,
      packageInfos: makePackageInfos({ [pkg]: { combinedOptions: { changeFilePrompt: { changePrompt } } } }),
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
    const questions = _getQuestionsForPackage({ ...defaultQuestionsParams, recentMessages });
    expect(questions).toEqual([
      expect.anything(),
      expect.objectContaining({
        name: 'comment',
        choices: recentMessageChoices,
        suggest: expect.any(Function),
      }),
    ]);

    const suggestions = await questions![1].suggest!('ba', recentMessageChoices);
    expect(suggestions).toEqual([{ title: 'Bar' }, { title: 'Baz' }]);
  });
});
