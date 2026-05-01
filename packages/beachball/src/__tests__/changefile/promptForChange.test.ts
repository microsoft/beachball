import { afterAll, afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type prompts from 'prompts';
import { promptForChange } from '../../changefile/promptForChange';
import type { ChangeFilePromptOptions } from '../../types/ChangeFilePrompt';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { MockStdin } from '../../__fixtures__/mockStdin';
import { MockStdout } from '../../__fixtures__/mockStdout';
import { makePackageInfos } from '../../__fixtures__/packageInfos';
import { expectBeachballError } from '../../__fixtures__/expectBeachballError';

// prompts writes to stdout (not console) in a way that can't really be mocked with spies,
// so instead we inject a custom mock stdout stream, as well as stdin for entering answers
let stdin: MockStdin;
let stdout: MockStdout;
jest.mock('prompts', () => {
  const realPrompts = jest.requireActual<typeof prompts>('prompts');

  return ((questions, options) => {
    const questionsArr = Array.isArray(questions) ? questions : [questions];
    return realPrompts(
      questionsArr.map(q => ({ ...q, stdin, stdout })),
      options
    );
  }) as typeof prompts;
});

/** Save and restore `process.stdin.isTTY` since `promptForChange` checks it for non-interactive detection */
const originalIsTTY = process.stdin.isTTY;

/**
 * These combined tests mainly cover various early bail-out cases (the only meaningful logic in
 * `promptForChange` itself), plus one basic case.
 * More detailed scenarios are covered by the tests for the helper functions.
 */
describe('promptForChange', () => {
  /** Wait for the prompt to finish rendering (simulates real user input) */
  const waitForPrompt = () => new Promise(resolve => process.nextTick(resolve));

  const logs = initMockLogs();

  /**
   * Default: packages foo, bar, baz; changes in foo, bar
   * (this is a function so stdin/stdout will be the latest values)
   */
  const defaultParams = (): Parameters<typeof promptForChange>[0] => ({
    changedPackages: ['foo', 'bar'],
    packageInfos: makePackageInfos({ foo: {}, bar: {}, baz: {} }),
    packageGroups: {},
    options: { message: '', disallowedChangeTypes: null },
    recentMessages: ['commit 2', 'commit 1'],
    email: null,
  });

  beforeEach(() => {
    stdin = new MockStdin();
    stdout = new MockStdout();
    // Simulate interactive TTY so prompts-based tests work regardless of the actual environment
    process.stdin.isTTY = true;
  });

  afterEach(() => {
    stdin.destroy();
    stdout.destroy();
  });

  afterAll(() => {
    // Restore the original isTTY value
    if (originalIsTTY === undefined) {
      delete (process.stdin as unknown as Record<string, unknown>).isTTY;
    } else {
      process.stdin.isTTY = originalIsTTY;
    }
  });

  it('does not create change files when there are no changes', async () => {
    const changeFiles = await promptForChange({ ...defaultParams(), changedPackages: [] });
    expect(changeFiles).toBeUndefined();
  });

  it('does not prompt if options.type and options.message are provided', async () => {
    const changeFiles = await promptForChange({
      ...defaultParams(),
      options: { type: 'minor', message: 'message', disallowedChangeTypes: null },
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
        bar: {
          beachball: { disallowedChangeTypes: ['major', 'minor', 'patch', 'none', 'premajor', 'preminor', 'prepatch'] },
        },
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
      options: { message: 'message', changeFilePrompt, disallowedChangeTypes: null },
      changedPackages: ['foo', 'bar'],
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

  describe('non-interactive detection', () => {
    beforeEach(() => {
      // Simulate non-interactive environment (stdin is not a TTY)
      process.stdin.isTTY = false;
    });

    it('throws an error when prompts are needed and stdin is not a TTY', async () => {
      await expectBeachballError(
        promptForChange(defaultParams()),
        'The "change" command is running in a non-interactive context'
      );
    });

    it('includes guidance about --package in the error', async () => {
      await expect(promptForChange(defaultParams())).rejects.toThrow(/--package/);
    });

    it('does not throw when type and message are both provided', async () => {
      const changeFiles = await promptForChange({
        ...defaultParams(),
        options: { type: 'minor', message: 'message', disallowedChangeTypes: null },
      });
      expect(changeFiles).toEqual([
        expect.objectContaining({ type: 'minor', comment: 'message', packageName: 'foo' }),
        expect.objectContaining({ type: 'minor', comment: 'message', packageName: 'bar' }),
      ]);
    });

    it('does not throw when there are no changed packages', async () => {
      const changeFiles = await promptForChange({ ...defaultParams(), changedPackages: [] });
      expect(changeFiles).toBeUndefined();
    });

    it('throws when only type is provided but message is missing', async () => {
      await expectBeachballError(
        promptForChange({
          ...defaultParams(),
          options: { type: 'minor', message: '', disallowedChangeTypes: null },
        }),
        'The "change" command is running in a non-interactive context'
      );
    });

    it('throws when only message is provided but type is missing', async () => {
      await expectBeachballError(
        promptForChange({
          ...defaultParams(),
          options: { message: 'some message', disallowedChangeTypes: null },
        }),
        'The "change" command is running in a non-interactive context'
      );
    });
  });
});
