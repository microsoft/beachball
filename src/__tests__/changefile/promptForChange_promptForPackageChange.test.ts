import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import prompts from 'prompts';
import { _getQuestionsForPackage, _promptForPackageChange } from '../../changefile/promptForChange';
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

/**
 * This covers the actual prompting part of `promptForChange`.
 */
describe('promptForChange _promptForPackageChange', () => {
  /** Package name used in the tests */
  const pkg = 'foo';

  /** Basic params for `_getQuestionsForPackage`, for a package named `foo` */
  const defaultQuestionsParams: Parameters<typeof _getQuestionsForPackage>[0] = {
    pkg,
    packageInfos: makePackageInfos({ [pkg]: {} }),
    packageGroups: {},
    options: { message: '' },
    recentMessages: ['message'],
  };
  const expectedQuestions = [
    expect.objectContaining({ name: 'type', type: 'select' }),
    expect.objectContaining({ name: 'comment', type: 'autocomplete' }),
  ];

  /** Wait for the prompt to finish rendering (simulates real user input) */
  const waitForPrompt = () => new Promise(resolve => process.nextTick(resolve));

  const logs = initMockLogs();

  beforeEach(() => {
    stdin = new MockStdin();
    // prompts writes a near-duplicate chunk with ... while it's processing input, so ignore that.
    // Also replace special characters used by `prompts` that will be different between platforms.
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
    const questions = _getQuestionsForPackage({
      ...defaultQuestionsParams,
      options: { type: 'minor', message: '' },
    });
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
    const questions = _getQuestionsForPackage({
      ...defaultQuestionsParams,
      options: { type: 'minor', message: '' },
    });
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
    const questions = _getQuestionsForPackage({
      ...defaultQuestionsParams,
      options: { type: 'minor', message: '' },
    });
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
    const questions = _getQuestionsForPackage({
      ...defaultQuestionsParams,
      recentMessages: ['foo', 'bar', 'baz'],
      options: { type: 'minor', message: '' },
    });
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
    const questions = _getQuestionsForPackage({
      ...defaultQuestionsParams,
      recentMessages: ['foo', 'bar', 'baz'],
      options: { type: 'minor', message: '' },
    });
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
