import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import prompts from 'prompts';
import {
  promptForChange,
  _getChangeFileInfoFromResponse,
  _getQuestionsForPackage,
  _promptForPackageChange,
} from '../../changefile/promptForChange';
import { BeachballOptions } from '../../types/BeachballOptions';
import { ChangeFilePromptOptions } from '../../types/ChangeFilePrompt';
import { ChangeFileInfo } from '../../types/ChangeInfo';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { MockStdin } from '../../__fixtures__/mockStdin';
import { MockStdout } from '../../__fixtures__/mockStdout';
import { makePackageInfos } from '../../__fixtures__/packageInfos';

// prompts writes to stdout (not console) in a way that can't really be mocked with spies,
// so instead we inject a custom mock stdout stream, as well as stdin for entering answers
let stdin: MockStdin;
let stdout: MockStdout;
jest.mock(
  'prompts',
  () =>
    ((questions, options) => {
      questions = Array.isArray(questions) ? questions : [questions];
      questions = questions.map(q => ({ ...q, stdin, stdout }));
      return (jest.requireActual('prompts') as typeof prompts)(questions, options);
    }) as typeof prompts
);

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
/** Make `prompts.Choice` objects from a list of messages */
const makeChoices = (messages: string[]): prompts.Choice[] => messages.map(message => ({ title: message }));

/** Wait for the prompt to finish rendering (simulates real user input) */
const waitForPrompt = () => new Promise(resolve => process.nextTick(resolve));

/**
 * These tests cover the logic within `promptForChange` that does *not* require filesystem operations.
 * `promptForChange` itself is covered by `__e2e__/change.test.ts`.
 */
describe('promptForChange', () => {
  describe('_getQuestionsForPackage', () => {
    /**
     * Mock console logs. NOTE: Initialization is only done in before/after all (not cleared every test
     * since only a few tests use logs), so tests should use `toHaveBeenLastCalledWith`.
     */
    const sharedLogs = initMockLogs({ onlyInitOnce: true });

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
      expect(sharedLogs.mocks.error).toHaveBeenLastCalledWith('Change type "major" is not allowed for package "foo"');
    });

    it('errors if there are no valid change types for package', () => {
      const questions = _getQuestionsForPackage({
        ...defaultQuestionsParams,
        packageInfos: makePackageInfos({
          [pkg]: { combinedOptions: { disallowedChangeTypes: ['major', 'minor', 'patch', 'none'] } },
        }),
      });
      expect(questions).toBeUndefined();
      expect(sharedLogs.mocks.error).toHaveBeenLastCalledWith('No valid change types available for package "foo"');
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
      const recentMessageChoices = makeChoices(recentMessages);
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
      expect(suggestions).toEqual(makeChoices(['Bar', 'Baz']));
    });
  });

  describe('_promptForPackageChange', () => {
    const expectedQuestions = [
      expect.objectContaining({ name: 'type', type: 'select' }),
      expect.objectContaining({ name: 'comment', type: 'autocomplete' }),
    ];
    const logs = initMockLogs();

    beforeEach(() => {
      stdin = new MockStdin();
      // prompts writes a near-duplicate chunk with ... while it's processing input, so ignore that.
      // Also replace
      stdout = new MockStdout({ ignoreChunks: [/ (…|\.\.\.)( |$)/m], replace: 'prompts' });
    });

    afterEach(() => {
      stdin.destroy();
      stdout.destroy();
    });

    it('returns an empty object and logs nothing if there are no questions', async () => {
      const answers = await _promptForPackageChange([], pkg);
      expect(answers).toEqual({});
      expect(logs.mocks.log).not.toHaveBeenCalled();
    });

    it('prompts for change type and description', async () => {
      const questions = _getQuestionsForPackage(defaultQuestionsParams);
      expect(questions).toEqual(expectedQuestions);

      const answersPromise = _promptForPackageChange(questions!, pkg);

      // input: press enter twice to use defaults (with a pause in between to simulate real user input)
      await stdin.sendByChar('\n\n');
      const answers = await answersPromise;

      expect(logs.getMockLines('log')).toMatchInlineSnapshot(`"Please describe the changes for: foo"`);
      expect(stdout.getOutput()).toMatchInlineSnapshot(`
        "? Change type » - Use arrow-keys. Return to submit.
        >    Patch      - bug fixes; no API changes.
             Minor      - small feature; backwards compatible API changes.
             None       - this change does not affect the published package in any way.
             Major      - major feature; breaking changes.
        √ Change type »  Patch      - bug fixes; no API changes.
        ? Describe changes (type or choose one) »
        >   message
        √ Describe changes (type or choose one) » message"
      `);
      expect(answers).toEqual({ type: 'patch', comment: 'message' });
    });

    it('accepts custom description typed by character', async () => {
      // For this one we provide a type in options and only ask for the description
      const options = { type: 'minor' } as BeachballOptions;
      const questions = _getQuestionsForPackage({ ...defaultQuestionsParams, options });
      expect(questions).toEqual(expectedQuestions.slice(1));

      const answerPromise = _promptForPackageChange(questions!, pkg);
      await waitForPrompt();
      expect(stdout.lastOutput()).toMatchInlineSnapshot(`
        "? Describe changes (type or choose one) »
        >   message"
      `);
      stdout.clearOutput();

      // input: a message which isn't included in the recent commits, sent by individual characters
      // (as if it was typed)
      await stdin.sendByChar('abc\n');
      const answers = await answerPromise;

      expect(logs.getMockLines('log')).toMatchInlineSnapshot(`"Please describe the changes for: foo"`);
      expect(stdout.getOutput()).toMatchInlineSnapshot(`
        "? Describe changes (type or choose one) » a
        ? Describe changes (type or choose one) » ab
        ? Describe changes (type or choose one) » abc
        √ Describe changes (type or choose one) » abc"
      `);
      expect(answers).toEqual({ comment: 'abc' });
    });

    it('accepts custom description pasted', async () => {
      // For this one we provide a type in options and only ask for the description
      const options = { type: 'minor' } as BeachballOptions;
      const questions = _getQuestionsForPackage({ ...defaultQuestionsParams, options });
      expect(questions).toEqual(expectedQuestions.slice(1));

      const answerPromise = _promptForPackageChange(questions!, pkg);
      await waitForPrompt();
      expect(stdout.lastOutput()).toMatchInlineSnapshot(`
        "? Describe changes (type or choose one) »
        >   message"
      `);
      stdout.clearOutput();

      // input: a message which isn't included in the recent commits, sent all at once
      // (as if it was pasted)
      stdin.send('abc');
      await stdin.sendByChar('\n');
      const answers = await answerPromise;

      expect(logs.getMockLines('log')).toMatchInlineSnapshot(`"Please describe the changes for: foo"`);
      expect(stdout.getOutput()).toMatchInlineSnapshot(`
        "? Describe changes (type or choose one) » abc
        √ Describe changes (type or choose one) » abc"
      `);
      expect(answers).toEqual({ comment: 'abc' });
    });

    it('accepts custom description pasted with newline', async () => {
      // For this one we provide a type in options and only ask for the description
      const options = { type: 'minor' } as BeachballOptions;
      const questions = _getQuestionsForPackage({ ...defaultQuestionsParams, options });
      expect(questions).toEqual(expectedQuestions.slice(1));

      const answerPromise = _promptForPackageChange(questions!, pkg);
      await waitForPrompt();
      expect(stdout.lastOutput()).toMatchInlineSnapshot(`
        "? Describe changes (type or choose one) »
        >   message"
      `);
      stdout.clearOutput();

      // input: a message which isn't included in the recent commits, sent all at once
      // (as if it was pasted)
      stdin.send('abc\n');
      const answers = await answerPromise;

      expect(logs.getMockLines('log')).toMatchInlineSnapshot(`"Please describe the changes for: foo"`);
      expect(stdout.getOutput()).toMatchInlineSnapshot(`""`);
      expect(answers).toEqual({ comment: 'abc' });
    });

    it('uses options selected with arrow keys', async () => {
      const recentMessages = ['first', 'second', 'third'];
      const questions = _getQuestionsForPackage({ ...defaultQuestionsParams, recentMessages });
      expect(questions).toEqual(expectedQuestions);

      const answerPromise = _promptForPackageChange(questions!, pkg);

      // arrow down to select the third type
      stdin.emitKey({ name: 'down' });
      stdin.emitKey({ name: 'down' });
      await stdin.sendByChar('\n');
      // and the second message
      stdin.emitKey({ name: 'down' });
      await stdin.sendByChar('\n');

      expect(stdout.getOutput()).toMatchInlineSnapshot(`
        "? Change type » - Use arrow-keys. Return to submit.
        >    Patch      - bug fixes; no API changes.
             Minor      - small feature; backwards compatible API changes.
             None       - this change does not affect the published package in any way.
             Major      - major feature; breaking changes.
        ? Change type » - Use arrow-keys. Return to submit.
             Patch      - bug fixes; no API changes.
        >    Minor      - small feature; backwards compatible API changes.
             None       - this change does not affect the published package in any way.
             Major      - major feature; breaking changes.
        ? Change type » - Use arrow-keys. Return to submit.
             Patch      - bug fixes; no API changes.
             Minor      - small feature; backwards compatible API changes.
        >    None       - this change does not affect the published package in any way.
             Major      - major feature; breaking changes.
        √ Change type »  None       - this change does not affect the published package in any way.
        ? Describe changes (type or choose one) »
        >   first
            second
            third
        ? Describe changes (type or choose one) »
            first
        >   second
            third
        √ Describe changes (type or choose one) » second"
      `);

      const answers = await answerPromise;
      expect(answers).toEqual({ type: 'none', comment: 'second' });
    });

    it('filters options while typing', async () => {
      const recentMessages = ['foo', 'bar', 'baz'];
      const options = { type: 'minor' } as BeachballOptions;
      const questions = _getQuestionsForPackage({ ...defaultQuestionsParams, recentMessages, options });
      expect(questions).toEqual(expectedQuestions.slice(1));

      const answerPromise = _promptForPackageChange(questions!, pkg);

      // type "ba" and press enter to select "bar"
      await stdin.sendByChar('ba\n');

      expect(stdout.getOutput()).toMatchInlineSnapshot(`
        "? Describe changes (type or choose one) »
        >   foo
            bar
            baz
        ? Describe changes (type or choose one) » b
        >   bar
            baz
        ? Describe changes (type or choose one) » ba
        >   bar
            baz
        √ Describe changes (type or choose one) » bar"
      `);

      const answers = await answerPromise;
      expect(answers).toEqual({ comment: 'bar' });
    });

    it('handles pressing delete while typing', async () => {
      const recentMessages = ['foo', 'bar', 'baz'];
      const options = { type: 'minor' } as BeachballOptions;
      const questions = _getQuestionsForPackage({ ...defaultQuestionsParams, recentMessages, options });
      expect(questions).toEqual(expectedQuestions.slice(1));

      const answerPromise = _promptForPackageChange(questions!, pkg);

      // type "b", press backspace to delete it, press enter to select foo
      await stdin.sendByChar('b');
      stdin.emitKey({ name: 'backspace' });
      await stdin.sendByChar('\n');

      expect(stdout.getOutput()).toMatchInlineSnapshot(`
        "? Describe changes (type or choose one) »
        >   foo
            bar
            baz
        ? Describe changes (type or choose one) » b
        >   bar
            baz
        ? Describe changes (type or choose one) »
        >   foo
            bar
            baz
        √ Describe changes (type or choose one) » foo"
      `);

      const answers = await answerPromise;
      expect(answers).toEqual({ comment: 'foo' });
    });

    it('returns no answers if cancelled with ctrl-c', async () => {
      const questions = _getQuestionsForPackage(defaultQuestionsParams);
      expect(questions).toEqual(expectedQuestions);

      const answerPromise = _promptForPackageChange(questions!, pkg);

      // answer the first question
      await stdin.sendByChar('\n');
      // start typing the second answer then cancel
      await stdin.sendByChar('a');
      stdin.emitKey({ name: 'c', ctrl: true });

      const answers = await answerPromise;

      expect(logs.getMockLines('log')).toMatchInlineSnapshot(`
        "Please describe the changes for: foo
        Cancelled, no change files are written"
      `);

      expect(stdout.getOutput()).toMatchInlineSnapshot(`
        "? Change type » - Use arrow-keys. Return to submit.
        >    Patch      - bug fixes; no API changes.
             Minor      - small feature; backwards compatible API changes.
             None       - this change does not affect the published package in any way.
             Major      - major feature; breaking changes.
        √ Change type »  Patch      - bug fixes; no API changes.
        ? Describe changes (type or choose one) »
        >   message
        ? Describe changes (type or choose one) » a
        × Describe changes (type or choose one) » a"
      `);

      expect(answers).toBeUndefined();
    });
  });

  describe('_getChangeFileInfoFromResponse', () => {
    const logs = initMockLogs();
    const comment = 'message';
    const defaultParams = { pkg, options: {} as BeachballOptions, email: null };

    it('works in normal case', () => {
      const change = _getChangeFileInfoFromResponse({ ...defaultParams, response: { comment, type: 'patch' } });
      expect<ChangeFileInfo>(change!).toEqual({
        type: 'patch',
        comment,
        packageName: pkg,
        email: 'email not defined',
        dependentChangeType: 'patch',
      });
      expect(logs.mocks.log).not.toHaveBeenCalled();
    });

    it('uses dependentChangeType none if response.type is none', () => {
      const change = _getChangeFileInfoFromResponse({ ...defaultParams, response: { comment, type: 'none' } });
      expect(change).toMatchObject({ type: 'none', dependentChangeType: 'none' });
      expect(logs.mocks.log).not.toHaveBeenCalled();
    });

    it('defaults to options.type if response.type is missing', () => {
      const change = _getChangeFileInfoFromResponse({
        ...defaultParams,
        response: { comment },
        options: { type: 'minor' } as BeachballOptions,
      });
      expect(change).toMatchObject({ type: 'minor', dependentChangeType: 'patch' });
      expect(logs.mocks.log).not.toHaveBeenCalled();
    });

    // this is somewhat debatable
    it('prefers response.type over options.type', () => {
      const change = _getChangeFileInfoFromResponse({
        ...defaultParams,
        response: { type: 'patch', comment },
        options: { type: 'minor' } as BeachballOptions,
      });
      expect(change).toMatchObject({ type: 'patch' });
    });

    it('warns and defaults to none if response.type and options.type are unspecified', () => {
      const change = _getChangeFileInfoFromResponse({ ...defaultParams, response: { comment } });
      expect(change).toMatchObject({ type: 'none', dependentChangeType: 'none' });
      expect(logs.mocks.log).toHaveBeenCalledTimes(2);
      expect(logs.getMockLines('log')).toMatchInlineSnapshot(`
        "WARN: change type 'none' assumed by default
        (Not what you intended? Check the repo-level and package-level beachball configs.)"
      `);
    });

    it('defaults to options.message if response.comment is missing', () => {
      const change = _getChangeFileInfoFromResponse({
        ...defaultParams,
        response: { type: 'patch' },
        options: { message: comment } as BeachballOptions,
      });
      expect(change).toMatchObject({ comment });
      expect(logs.mocks.log).not.toHaveBeenCalled();
    });

    // this is somewhat debatable
    it('prefers response.message over options.message', () => {
      const change = _getChangeFileInfoFromResponse({
        ...defaultParams,
        response: { type: 'patch', comment: 'response message' },
        options: { message: comment } as BeachballOptions,
      });
      expect(change).toMatchObject({ comment: 'response message' });
    });

    it('uses options.dependentChangeType if provided', () => {
      const change = _getChangeFileInfoFromResponse({
        ...defaultParams,
        response: { type: 'patch', comment },
        options: { dependentChangeType: 'minor' } as BeachballOptions,
      });
      expect(change).toMatchObject({ dependentChangeType: 'minor' });
    });

    it('returns error if response.type is invalid', () => {
      const change = _getChangeFileInfoFromResponse({ ...defaultParams, response: { type: 'invalid' as any } });
      expect(change).toBeUndefined();
      expect(logs.mocks.error).toHaveBeenCalledTimes(1);
      expect(logs.mocks.error).toHaveBeenCalledWith('Prompt response contains invalid change type "invalid"');
    });

    // This is an important scenario for some people who customize the change prompt
    it('preserves extra properties on the returned object', () => {
      const change = _getChangeFileInfoFromResponse({
        ...defaultParams,
        response: { comment, type: 'patch', extra: 'extra' } as any,
      });
      expect(change).toMatchObject({ extra: 'extra' });
    });
  });

  // These combined tests mainly cover various early bail-out cases
  describe('promptForChange', () => {
    const logs = initMockLogs();

    /**
     * Default: packages foo, bar, baz; changes in foo, bar
     * (this is a function so stdin/stdout will be the latest values)
     */
    const defaultParams = (): Parameters<typeof promptForChange>[0] => ({
      changedPackages: ['foo', 'bar'],
      packageInfos: makePackageInfos({ foo: {}, bar: {}, baz: {} }),
      packageGroups: {},
      options: {} as BeachballOptions,
      recentMessages: ['commit 2', 'commit 1'],
      email: null,
    });

    beforeEach(() => {
      stdin = new MockStdin();
      stdout = new MockStdout();
    });

    afterEach(() => {
      stdin.destroy();
      stdout.destroy();
    });

    it('does not create change files when there are no changes', async () => {
      const changeFiles = await promptForChange({ ...defaultParams(), changedPackages: [] });
      expect(changeFiles).toBeUndefined();
    });

    it('does not prompt if options.type and options.message are provided', async () => {
      const changeFiles = await promptForChange({
        ...defaultParams(),
        options: { type: 'minor', message: 'message' } as BeachballOptions,
      });
      expect(changeFiles).toEqual([
        expect.objectContaining({ type: 'minor', comment: 'message', packageName: 'foo' }),
        expect.objectContaining({ type: 'minor', comment: 'message', packageName: 'bar' }),
      ]);
    });

    // Do one "normal" end-to-end case (the details are covered by helper function tests)
    it('prompts for change for multiple packages', async () => {
      const changeFilesPromise = promptForChange(defaultParams());
      await waitForPrompt();

      // verify asking for first package
      expect(logs.mocks.log).toHaveBeenLastCalledWith('Please describe the changes for: foo');
      // choose custom options for this package
      stdin.emitKey({ name: 'down' });
      await stdin.sendByChar('\n');
      stdin.emitKey({ name: 'down' });
      await stdin.sendByChar('\n');

      // verify asking for second package
      expect(logs.mocks.log).toHaveBeenLastCalledWith('Please describe the changes for: bar');
      // choose defaults
      await stdin.sendByChar('\n\n');

      expect(await changeFilesPromise).toEqual([
        expect.objectContaining({ comment: 'commit 1', packageName: 'foo', type: 'minor' }),
        expect.objectContaining({ comment: 'commit 2', packageName: 'bar', type: 'patch' }),
      ]);
    });

    it('stops before asking questions if one package has invalid options', async () => {
      const changeFiles = await promptForChange({
        ...defaultParams(),
        packageInfos: makePackageInfos({
          foo: {},
          bar: { combinedOptions: { disallowedChangeTypes: ['major', 'minor', 'patch', 'none'] } },
        }),
      });

      expect(changeFiles).toBeUndefined();
      expect(logs.mocks.error).toHaveBeenLastCalledWith('No valid change types available for package "bar"');
      expect(logs.mocks.log).not.toHaveBeenCalled();
    });

    it('stops partway through if the user cancels', async () => {
      const changeFilesPromise = promptForChange(defaultParams());
      await waitForPrompt();

      // use defaults for first package
      expect(logs.mocks.log).toHaveBeenLastCalledWith('Please describe the changes for: foo');
      await stdin.sendByChar('\n\n');

      // cancel for second package
      expect(logs.mocks.log).toHaveBeenLastCalledWith('Please describe the changes for: bar');
      stdin.emitKey({ name: 'c', ctrl: true });

      // nothing is returned
      expect(await changeFilesPromise).toBeUndefined();
      expect(logs.mocks.log).toHaveBeenLastCalledWith('Cancelled, no change files are written');
    });

    it('stops partway through if a response is invalid', async () => {
      // this can only happen with custom prompts
      const changeFilePrompt: ChangeFilePromptOptions = {
        changePrompt: () => [{ type: 'text', name: 'type', message: 'enter any type' }],
      };
      const changeFilesPromise = promptForChange({
        ...defaultParams(),
        changedPackages: ['foo', 'bar'],
        packageInfos: makePackageInfos({
          foo: { combinedOptions: { changeFilePrompt } },
          bar: { combinedOptions: { changeFilePrompt } },
        }),
      });
      await waitForPrompt();

      // enter a valid type for foo
      expect(logs.mocks.log).toHaveBeenLastCalledWith('Please describe the changes for: foo');
      expect(stdout.getOutput()).toMatch(/enter any type/);
      await stdin.sendByChar('patch\n');

      // enter an invalid type for bar
      expect(logs.mocks.log).toHaveBeenCalledWith('Please describe the changes for: bar');
      await stdin.sendByChar('invalid\n');

      expect(await changeFilesPromise).toBeUndefined();
      expect(logs.mocks.error).toHaveBeenLastCalledWith('Prompt response contains invalid change type "invalid"');
    });
  });
});
