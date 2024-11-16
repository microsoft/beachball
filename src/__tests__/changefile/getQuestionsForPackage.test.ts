import { describe, expect, it, jest } from '@jest/globals';
import prompts from 'prompts';
import { getQuestionsForPackage } from '../../changefile/getQuestionsForPackage';
import { ChangeFilePromptOptions, ChangeTypeDescriptions } from '../../types/ChangeFilePrompt';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { makePackageInfos } from '../../__fixtures__/packageInfos';

/**
 * This covers the first part of `promptForChange`: determining what questions to ask for each package.
 */
describe('getQuestionsForPackage', () => {
  /** Package name used in the tests */
  const pkg = 'foo';

  /** Basic params for `getQuestionsForPackage`, for a package named `foo` */
  const defaultQuestionsParams: Parameters<typeof getQuestionsForPackage>[0] = {
    pkg,
    packageInfos: makePackageInfos({ [pkg]: {} }),
    packageGroups: {},
    options: { message: '' },
    recentMessages: ['message'],
  };

  const logs = initMockLogs();

  it('works in basic case', () => {
    const questions = getQuestionsForPackage(defaultQuestionsParams);
    expect(questions).toEqual([
      {
        choices: [
          { title: ' [1mPatch[22m      - bug fixes; no API changes', value: 'patch' },
          { title: ' [1mMinor[22m      - new feature; backwards-compatible API changes', value: 'minor' },
          { title: ' [1mNone[22m       - this change does not affect the published package in any way', value: 'none' },
          { title: ' [1mMajor[22m      - breaking changes; major feature', value: 'major' },
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

  it('uses different descriptions for v0 package', () => {
    const questions = getQuestionsForPackage({
      ...defaultQuestionsParams,
      packageInfos: makePackageInfos({ [pkg]: { version: '0.1.0' } }),
    });
    expect(questions![0].choices).toEqual([
      {
        title:
          ' [1mPatch[22m      - bug fixes; new features; backwards-compatible API changes (ok in patches for v0.x packages)',
        value: 'patch',
      },
      {
        title: ' [1mMinor[22m      - breaking changes; major feature (ok in minor versions for v0.x packages)',
        value: 'minor',
      },
      { title: ' [1mNone[22m       - this change does not affect the published package in any way', value: 'none' },
      { title: ' [1mMajor[22m      - official release', value: 'major' },
    ]);
  });

  // it's somewhat debatable if this is correct (maybe --type should be the override for disallowedChangeTypes?)
  it('errors if options.type is disallowed', () => {
    const questions = getQuestionsForPackage({
      ...defaultQuestionsParams,
      packageInfos: makePackageInfos({ [pkg]: { combinedOptions: { disallowedChangeTypes: ['major'] } } }),
      options: { type: 'major', message: '' },
    });
    expect(questions).toBeUndefined();
    expect(logs.mocks.error).toHaveBeenCalledWith('Change type "major" is not allowed for package "foo"');
  });

  it('errors if there are no valid change types for package', () => {
    const questions = getQuestionsForPackage({
      ...defaultQuestionsParams,
      packageInfos: makePackageInfos({
        [pkg]: { combinedOptions: { disallowedChangeTypes: ['major', 'minor', 'patch', 'none'] } },
      }),
    });
    expect(questions).toBeUndefined();
    expect(logs.mocks.error).toHaveBeenCalledWith('No valid change types available for package "foo"');
  });

  it('respects disallowedChangeTypes', () => {
    const questions = getQuestionsForPackage({
      ...defaultQuestionsParams,
      packageInfos: makePackageInfos({ [pkg]: { combinedOptions: { disallowedChangeTypes: ['major'] } } }),
    });
    const choices = (questions![0].choices as prompts.Choice[]).map(c => c.value);
    expect(choices).toEqual(['patch', 'minor', 'none']);
  });

  it('allows prerelease change for package with prerelease version', () => {
    const questions = getQuestionsForPackage({
      ...defaultQuestionsParams,
      packageInfos: makePackageInfos({ [pkg]: { version: '1.0.0-beta.1' } }),
    });
    const choices = (questions![0].choices as prompts.Choice[]).map(c => c.value);
    expect(choices).toEqual(['prerelease', 'patch', 'minor', 'none', 'major']);
  });

  // this is a bit weird as well, but documenting current behavior
  it('excludes prerelease if disallowed', () => {
    const questions = getQuestionsForPackage({
      ...defaultQuestionsParams,
      packageInfos: makePackageInfos({
        [pkg]: { version: '1.0.0-beta.1', combinedOptions: { disallowedChangeTypes: ['prerelease'] } },
      }),
    });
    const choices = (questions![0].choices as prompts.Choice[]).map(c => c.value);
    expect(choices).toEqual(['patch', 'minor', 'none', 'major']);
  });

  it('excludes the change type question when options.type is specified', () => {
    const questions = getQuestionsForPackage({
      ...defaultQuestionsParams,
      options: { type: 'patch', message: '' },
    });
    expect(questions).toHaveLength(1);
    expect(questions![0].name).toBe('comment');
  });

  it('excludes the change type question with only one valid option', () => {
    const questions = getQuestionsForPackage({
      ...defaultQuestionsParams,
      packageInfos: makePackageInfos({
        [pkg]: { combinedOptions: { disallowedChangeTypes: ['major', 'minor', 'none'] } },
      }),
    });
    expect(questions).toHaveLength(1);
    expect(questions![0].name).toBe('comment');
  });

  it('excludes the change type question when prerelease is implicitly the only valid option', () => {
    const questions = getQuestionsForPackage({
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
    const questions = getQuestionsForPackage({
      ...defaultQuestionsParams,
      options: { message: 'message' },
    });
    expect(questions).toHaveLength(1);
    expect(questions![0].name).toBe('type');
  });

  it('uses options.changeFilePrompt if set', () => {
    const customQuestions: prompts.PromptObject[] = [{ name: 'custom', message: 'custom prompt', type: 'text' }];
    const changePrompt: ChangeFilePromptOptions['changePrompt'] = jest.fn(() => customQuestions);

    const questions = getQuestionsForPackage({
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

  it('uses options.changeTypeDescriptions if set', () => {
    const changeTypeDescriptions: ChangeTypeDescriptions = {
      major: 'exciting',
      minor: { v0: 'exciting v0!', general: 'boring' },
      premajor: 'almost exciting',
    };
    const questions = getQuestionsForPackage({
      ...defaultQuestionsParams,
      packageInfos: makePackageInfos({
        [pkg]: { version: '1.0.0', combinedOptions: { changeFilePrompt: { changeTypeDescriptions } } },
      }),
    });

    expect(questions![0].choices).toEqual([
      { title: ' [1mMajor[22m      - exciting', value: 'major' },
      { title: ' [1mMinor[22m      - boring', value: 'minor' },
      { title: ' [1mPremajor[22m   - almost exciting', value: 'premajor' },
    ]);
  });

  it('uses v0-specific options.changeTypeDescriptions if set', () => {
    const changeTypeDescriptions: ChangeTypeDescriptions = {
      major: 'exciting',
      minor: { v0: 'exciting v0!', general: 'boring' },
      premajor: 'almost exciting',
    };
    const questions = getQuestionsForPackage({
      ...defaultQuestionsParams,
      packageInfos: makePackageInfos({
        [pkg]: { version: '0.1.0', combinedOptions: { changeFilePrompt: { changeTypeDescriptions } } },
      }),
    });

    expect(questions![0].choices).toEqual([
      { title: ' [1mMajor[22m      - exciting', value: 'major' },
      { title: ' [1mMinor[22m      - exciting v0!', value: 'minor' },
      { title: ' [1mPremajor[22m   - almost exciting', value: 'premajor' },
    ]);
  });

  it('does case-insensitive filtering on description suggestions', async () => {
    const recentMessages = ['Foo', 'Bar', 'Baz'];
    const recentMessageChoices = [{ title: 'Foo' }, { title: 'Bar' }, { title: 'Baz' }];
    const questions = getQuestionsForPackage({ ...defaultQuestionsParams, recentMessages });
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
