import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { initMockLogs } from '@microsoft/beachball-test-utilities';
import type prompts from 'prompts';
import { getChangeFiles, readGroupedChangeFile, readSingleChangeFile } from '../__fixtures__/changeFiles';
import { defaultBranchName, defaultRemoteBranchName } from '../__fixtures__/gitDefaults';
import { MockStdin } from '../__fixtures__/mockStdin';
import { MockStdout } from '../__fixtures__/mockStdout';
import type { Repository } from '../__fixtures__/repository';
import { type RepoFixture, RepositoryFactory } from '../__fixtures__/repositoryFactory';
import { change } from '../commands/change';
import { createBasicCommandContext } from '../monorepo/createCommandContext';
import { getOptions } from '../options/getOptions';
import type { BeachballOptions, RepoOptions } from '../types/BeachballOptions';
import type { ChangeCommandContext } from '../types/CommandContext';

// prompts writes to stdout (not console) in a way that can't really be mocked with spies,
// so instead we inject a custom mock stdout stream, as well as stdin for entering answers.
// (babel-plugin-jest-hoist requires variables referenced by `jest.mock()` factories to be
// prefixed with `mock`, so the locals are named `mockStdin`/`mockStdout`.)
let mockStdin: MockStdin;
let mockStdout: MockStdout;
jest.mock(
  'prompts',
  (): typeof prompts =>
    ((questions, options) => {
      questions = Array.isArray(questions) ? questions : [questions];
      questions = questions.map(q => ({ ...q, stdin: mockStdin, stdout: mockStdout }));
      return jest.requireActual<typeof prompts>('prompts')(questions, options);
    }) as typeof prompts
);

/**
 * Inject these options into `PackageInfo.combinedOptions` for every package to simulate a
 * repo-wide config. (Actual repo-wide configs aren't usually read in tests because the current
 * implementation depends on the actual cwd, not the temp repo directory.)
 */
let mockBeachballOptions: Partial<BeachballOptions> | undefined;
jest.mock('../options/getDefaultOptions', () => ({
  getDefaultOptions: () => ({
    ...jest
      .requireActual<typeof import('../options/getDefaultOptions')>('../options/getDefaultOptions')
      .getDefaultOptions(),
    ...mockBeachballOptions,
  }),
}));

/** Wait for the prompt to finish rendering (simulates real user input) */
const waitForPrompt = () => new Promise(resolve => process.nextTick(resolve));

const monorepo: RepoFixture['folders'] = {
  packages: { 'pkg-1': { version: '1.0.0' }, 'pkg-2': { version: '1.0.0' }, 'pkg-3': { version: '1.0.0' } },
};

function makeMonorepoChanges(repo: Repository) {
  repo.checkout('-b', 'test');
  repo.stageChange('packages/pkg-1/file.js');
  repo.commitAll('commit 1');
  repo.stageChange('packages/pkg-2/file.js');
  repo.commitAll('commit 2');
}

/** Check out a branch with a unique name based on master */
function checkOutTestBranch(repo: Repository) {
  const branchName = expect.getState().currentTestName!.replace(/\W+/g, '-');
  repo.checkout('-b', branchName, defaultBranchName);
}

// Save and restore process.stdin.isTTY since promptForChange checks it for non-interactive detection
const originalIsTTY = process.stdin.isTTY;

describe('change command', () => {
  // These tests can reuse factories since they currently don't push to remote
  let singleFactory: RepositoryFactory;
  /** Custom monorepo factory using the `monorepo` fixture */
  let monorepoFactory: RepositoryFactory;
  /** Repo being used by this test */
  let repo: Repository | undefined;

  const logs = initMockLogs();

  /** Get options and context (`changedPackages` is not filled) */
  async function getOptionsAndContext(repoOptions?: Partial<RepoOptions>, extraArgv?: string[]) {
    const parsedOptions = await getOptions({
      cwd: repo!.rootPath,
      argv: ['node', 'beachball', 'change', ...(extraArgv ?? [])],
      env: {},
      testRepoOptions: {
        branch: defaultRemoteBranchName,
        ...repoOptions,
      },
    });
    const context: ChangeCommandContext = {
      ...createBasicCommandContext(parsedOptions),
      changedPackages: undefined,
    };
    return { options: parsedOptions.options, context };
  }

  beforeAll(() => {
    singleFactory = new RepositoryFactory('single');
    monorepoFactory = new RepositoryFactory({ folders: monorepo });
  });

  beforeEach(() => {
    mockStdin = new MockStdin();
    mockStdout = new MockStdout({ replace: 'prompts' });
    // Simulate interactive TTY so prompts-based tests work regardless of the actual environment
    Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
  });

  afterEach(() => {
    mockStdin.destroy();
    mockStdout.destroy();
    repo = undefined;
    mockBeachballOptions = undefined;
    // Restore the original isTTY value
    if (originalIsTTY === undefined) {
      delete (process.stdin as unknown as Record<string, unknown>).isTTY;
    } else {
      Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, configurable: true });
    }
  });

  afterAll(() => {
    singleFactory.cleanUp();
    monorepoFactory.cleanUp();
  });

  it('does not create change files when there are no changes', async () => {
    repo = singleFactory.cloneRepository();
    checkOutTestBranch(repo);

    const { options, context } = await getOptionsAndContext();
    await change(options, context);

    expect(getChangeFiles(options)).toHaveLength(0);
  });

  it('creates and stages a change file', async () => {
    repo = singleFactory.cloneRepository();
    checkOutTestBranch(repo);
    repo.commitChange('file.js');

    const { options, context } = await getOptionsAndContext({ commit: false });
    const changePromise = change(options, context);
    await waitForPrompt();

    // Use default change type and custom message
    expect(logs.mocks.log).toHaveBeenLastCalledWith('Please describe the changes for: foo');
    await mockStdin.sendByChar('\n');
    // Also verify that the options shown are correct
    expect(mockStdout.lastOutput()).toMatchInlineSnapshot(`
      "? Describe changes (type or choose one) »
      >   "file.js""
    `);
    await mockStdin.sendByChar('stage me please\n');
    await changePromise;

    expect(repo.status()).toMatch(/^A  change/);
    expect(logs.mocks.log).toHaveBeenLastCalledWith(expect.stringMatching(/^git staged these change files:/));

    const changeFiles = getChangeFiles(options);
    expect(changeFiles).toHaveLength(1);
    expect(readSingleChangeFile(changeFiles[0])).toEqual({
      comment: 'stage me please',
      email: 'ci@example.com',
      packageName: 'foo',
      type: 'patch',
    });
  });

  it('creates and commits a change file', async () => {
    repo = singleFactory.cloneRepository();
    checkOutTestBranch(repo);
    repo.commitChange('file.js');

    const { options, context } = await getOptionsAndContext();
    const changePromise = change(options, context);

    expect(logs.mocks.log).toHaveBeenLastCalledWith('Please describe the changes for: foo');
    await mockStdin.sendByChar('\n'); // default change type
    await mockStdin.sendByChar('commit me please\n'); // custom message
    await changePromise;

    expect(logs.mocks.log).toHaveBeenLastCalledWith(expect.stringMatching(/^git committed these change files:/));
    expect(repo.status()).toBe('');

    const changeFiles = getChangeFiles(options);
    expect(changeFiles).toHaveLength(1);
    expect(readSingleChangeFile(changeFiles[0])).toMatchObject({
      comment: 'commit me please',
      packageName: 'foo',
      type: 'patch',
    });
  });

  it('creates and commits a change file with changeDir set', async () => {
    repo = singleFactory.cloneRepository();
    checkOutTestBranch(repo);
    repo.commitChange('file.js');

    const testChangedir = 'changeDir';
    const { options, context } = await getOptionsAndContext({
      changeDir: testChangedir,
    });
    const changePromise = change(options, context);

    expect(logs.mocks.log).toHaveBeenLastCalledWith('Please describe the changes for: foo');
    await mockStdin.sendByChar('\n'); // default change type
    await mockStdin.sendByChar('commit me please\n'); // custom message
    await changePromise;

    expect(logs.mocks.log).toHaveBeenLastCalledWith(expect.stringMatching(/^git committed these change files:/));
    expect(repo.status()).toBe('');

    const changeFiles = getChangeFiles(options);
    expect(changeFiles).toHaveLength(1);
    expect(readSingleChangeFile(changeFiles[0])).toMatchObject({
      comment: 'commit me please',
      packageName: 'foo',
      type: 'patch',
    });
  });

  it('creates a change file when there are no changes but package name is provided', async () => {
    repo = singleFactory.cloneRepository();
    checkOutTestBranch(repo);

    const { options, context } = await getOptionsAndContext({}, [
      '--package',
      singleFactory.fixture.rootPackage.name,
      '--no-commit',
    ]);
    const changePromise = change(options, context);
    await waitForPrompt();

    expect(logs.mocks.log).toHaveBeenLastCalledWith('Please describe the changes for: foo');
    await mockStdin.sendByChar('\n'); // default change type
    await mockStdin.sendByChar('stage me please\n'); // custom message
    await changePromise;

    expect(repo.status()).toMatch(/^A  change/);

    const changeFiles = getChangeFiles(options);
    expect(changeFiles).toHaveLength(1);
  });

  it('creates and commits change files for multiple packages', async () => {
    repo = monorepoFactory.cloneRepository();
    checkOutTestBranch(repo);
    makeMonorepoChanges(repo);

    const { options, context } = await getOptionsAndContext();
    const changePromise = change(options, context);

    // use custom values for first package
    expect(logs.mocks.log).toHaveBeenLastCalledWith('Please describe the changes for: pkg-1');
    mockStdin.emitKey({ name: 'down' });
    await mockStdin.sendByChar('\n');
    // also verify that the options shown are correct
    expect(mockStdout.lastOutput()).toMatchInlineSnapshot(`
      "? Describe changes (type or choose one) »
      >   commit 2
          commit 1"
    `);
    await mockStdin.sendByChar('custom\n');

    // use defaults for second package
    expect(logs.mocks.log).toHaveBeenLastCalledWith('Please describe the changes for: pkg-2');
    await mockStdin.sendByChar('\n\n');

    await changePromise;

    expect(logs.mocks.log).toHaveBeenLastCalledWith(expect.stringMatching(/^git committed these change files:/));
    expect(repo.status()).toBe('');

    const changeFiles = getChangeFiles(options);
    expect(changeFiles).toHaveLength(2);
    const changeFileContents = changeFiles.map(changeFile => readSingleChangeFile(changeFile));
    expect(changeFileContents).toContainEqual(
      expect.objectContaining({ comment: 'custom', packageName: 'pkg-1', type: 'minor' })
    );
    expect(changeFileContents).toContainEqual(
      expect.objectContaining({ comment: 'commit 2', packageName: 'pkg-2', type: 'patch' })
    );
  });

  it('creates and commits grouped change file for multiple packages', async () => {
    repo = monorepoFactory.cloneRepository();
    checkOutTestBranch(repo);
    makeMonorepoChanges(repo);

    const { options, context } = await getOptionsAndContext({
      groupChanges: true,
    });
    const changePromise = change(options, context);

    // use custom values for first package
    expect(logs.mocks.log).toHaveBeenLastCalledWith('Please describe the changes for: pkg-1');
    mockStdin.emitKey({ name: 'down' });
    await mockStdin.sendByChar('\n');
    await mockStdin.sendByChar('custom\n');

    // use defaults for second package
    expect(logs.mocks.log).toHaveBeenLastCalledWith('Please describe the changes for: pkg-2');
    await mockStdin.sendByChar('\n\n');

    await changePromise;

    expect(logs.mocks.log).toHaveBeenLastCalledWith(expect.stringMatching(/^git committed these change files:/));
    expect(repo.status()).toBe('');

    const changeFiles = getChangeFiles(options);
    expect(changeFiles).toHaveLength(1);
    const contents = readGroupedChangeFile(changeFiles[0]);
    expect(contents.changes).toEqual([
      expect.objectContaining({ comment: 'custom', packageName: 'pkg-1', type: 'minor' }),
      expect.objectContaining({ comment: 'commit 2', packageName: 'pkg-2', type: 'patch' }),
    ]);
  });

  it('uses custom per-package prompt', async () => {
    repo = monorepoFactory.cloneRepository();
    checkOutTestBranch(repo);
    makeMonorepoChanges(repo);

    mockBeachballOptions = {
      changeFile: {
        changePrompt: (defaultPrompt, pkg) => {
          const questions = [defaultPrompt.changeType!, defaultPrompt.description!];
          return pkg === 'pkg-1'
            ? questions
            : [{ type: 'text', name: 'custom', message: 'custom question' }, ...questions];
        },
      },
    };

    const { options, context } = await getOptionsAndContext({
      groupChanges: true,
    });
    const changePromise = change(options, context);
    await waitForPrompt();

    expect(logs.mocks.log).toHaveBeenLastCalledWith('Please describe the changes for: pkg-1');
    expect(mockStdout.lastOutput()).toMatch(/Change type/);
    await mockStdin.sendByChar('\n');
    expect(mockStdout.lastOutput()).toMatch(/Describe changes/);
    await mockStdin.sendByChar('\n');

    expect(logs.mocks.log).toHaveBeenLastCalledWith('Please describe the changes for: pkg-2');
    expect(mockStdout.lastOutput()).toMatch(/custom question/);
    await mockStdin.sendByChar('stuff\n');
    expect(mockStdout.lastOutput()).toMatch(/Change type/);
    await mockStdin.sendByChar('\n');
    expect(mockStdout.lastOutput()).toMatch(/Describe changes/);
    await mockStdin.sendByChar('\n');

    await changePromise;

    const changeFiles = getChangeFiles(options);
    expect(changeFiles).toHaveLength(1);
    const contents = readGroupedChangeFile(changeFiles[0]);
    expect(contents.changes).toEqual([
      expect.objectContaining({ packageName: 'pkg-1', type: 'patch', comment: 'commit 2' }),
      expect.objectContaining({ packageName: 'pkg-2', type: 'patch', comment: 'commit 2', custom: 'stuff' }),
    ]);
  });

  // custom prompt for different packages (only truly doable here because elsewhere it uses combinedOptions)
});
