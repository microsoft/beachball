import { describe, expect, it, afterEach, jest, beforeEach, beforeAll, afterAll } from '@jest/globals';
import type prompts from 'prompts';
import { getChangeFiles } from '../__fixtures__/changeFiles';
import { initMockLogs } from '../__fixtures__/mockLogs';
import { type RepoFixture, RepositoryFactory } from '../__fixtures__/repositoryFactory';
import { change } from '../commands/change';
import type { BeachballOptions, RepoOptions } from '../types/BeachballOptions';
import { defaultBranchName, defaultRemoteBranchName } from '../__fixtures__/gitDefaults';
import { MockStdout } from '../__fixtures__/mockStdout';
import { MockStdin } from '../__fixtures__/mockStdin';
import type { ChangeFileInfo, ChangeInfoMultiple } from '../types/ChangeInfo';
import type { Repository } from '../__fixtures__/repository';
import { getParsedOptions } from '../options/getOptions';
import { readJson } from '../object/readJson';
import { createBasicCommandContext } from '../monorepo/createCommandContext';
import type { ChangeCommandContext } from '../types/CommandContext';

// prompts writes to stdout (not console) in a way that can't really be mocked with spies,
// so instead we inject a custom mock stdout stream, as well as stdin for entering answers
let stdin: MockStdin;
let stdout: MockStdout;
jest.mock(
  'prompts',
  (): typeof prompts =>
    ((questions, options) => {
      questions = Array.isArray(questions) ? questions : [questions];
      questions = questions.map(q => ({ ...q, stdin, stdout }));
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

describe('change command', () => {
  // These tests can reuse factories since they currently don't push to remote
  let singleFactory: RepositoryFactory;
  /** Custom monorepo factory using the `monorepo` fixture */
  let monorepoFactory: RepositoryFactory;
  /** Repo being used by this test */
  let repo: Repository | undefined;

  const logs = initMockLogs();

  /** Get options and context (`changedPackages` is not filled) */
  function getOptionsAndContext(repoOptions?: Partial<RepoOptions>, extraArgv?: string[]) {
    const parsedOptions = getParsedOptions({
      cwd: repo!.rootPath,
      argv: ['node', 'beachball', 'change', ...(extraArgv ?? [])],
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
    stdin = new MockStdin();
    stdout = new MockStdout({ replace: 'prompts' });
  });

  afterEach(() => {
    stdin.destroy();
    stdout.destroy();
    repo = undefined;
    mockBeachballOptions = undefined;
  });

  afterAll(() => {
    singleFactory.cleanUp();
    monorepoFactory.cleanUp();
  });

  it('does not create change files when there are no changes', async () => {
    repo = singleFactory.cloneRepository();
    checkOutTestBranch(repo);

    const { options, context } = getOptionsAndContext();
    await change(options, context);

    expect(getChangeFiles(options)).toHaveLength(0);
  });

  it('creates and stages a change file', async () => {
    repo = singleFactory.cloneRepository();
    checkOutTestBranch(repo);
    repo.commitChange('file.js');

    const { options, context } = getOptionsAndContext({ commit: false });
    const changePromise = change(options, context);
    await waitForPrompt();

    // Use default change type and custom message
    expect(logs.mocks.log).toHaveBeenLastCalledWith('Please describe the changes for: foo');
    await stdin.sendByChar('\n');
    // Also verify that the options shown are correct
    expect(stdout.lastOutput()).toMatchInlineSnapshot(`
      "? Describe changes (type or choose one) »
      >   "file.js""
    `);
    await stdin.sendByChar('stage me please\n');
    await changePromise;

    expect(repo.status()).toMatch(/^A  change/);
    expect(logs.mocks.log).toHaveBeenLastCalledWith(expect.stringMatching(/^git staged these change files:/));

    const changeFiles = getChangeFiles(options);
    expect(changeFiles).toHaveLength(1);
    expect(readJson(changeFiles[0])).toMatchObject({
      comment: 'stage me please',
      packageName: 'foo',
      type: 'patch',
    });
  });

  it('creates and commits a change file', async () => {
    repo = singleFactory.cloneRepository();
    checkOutTestBranch(repo);
    repo.commitChange('file.js');

    const { options, context } = getOptionsAndContext();
    const changePromise = change(options, context);

    expect(logs.mocks.log).toHaveBeenLastCalledWith('Please describe the changes for: foo');
    await stdin.sendByChar('\n'); // default change type
    await stdin.sendByChar('commit me please\n'); // custom message
    await changePromise;

    expect(logs.mocks.log).toHaveBeenLastCalledWith(expect.stringMatching(/^git committed these change files:/));
    expect(repo.status()).toBe('');

    const changeFiles = getChangeFiles(options);
    expect(changeFiles).toHaveLength(1);
    expect(readJson(changeFiles[0])).toMatchObject({
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
    const { options, context } = getOptionsAndContext({
      changeDir: testChangedir,
    });
    const changePromise = change(options, context);

    expect(logs.mocks.log).toHaveBeenLastCalledWith('Please describe the changes for: foo');
    await stdin.sendByChar('\n'); // default change type
    await stdin.sendByChar('commit me please\n'); // custom message
    await changePromise;

    expect(logs.mocks.log).toHaveBeenLastCalledWith(expect.stringMatching(/^git committed these change files:/));
    expect(repo.status()).toBe('');

    const changeFiles = getChangeFiles(options);
    expect(changeFiles).toHaveLength(1);
    expect(readJson(changeFiles[0])).toMatchObject({
      comment: 'commit me please',
      packageName: 'foo',
      type: 'patch',
    });
  });

  it('creates a change file when there are no changes but package name is provided', async () => {
    repo = singleFactory.cloneRepository();
    checkOutTestBranch(repo);

    const { options, context } = getOptionsAndContext({}, [
      '--package',
      singleFactory.fixture.rootPackage.name,
      '--no-commit',
    ]);
    const changePromise = change(options, context);
    await waitForPrompt();

    expect(logs.mocks.log).toHaveBeenLastCalledWith('Please describe the changes for: foo');
    await stdin.sendByChar('\n'); // default change type
    await stdin.sendByChar('stage me please\n'); // custom message
    await changePromise;

    expect(repo.status()).toMatch(/^A  change/);

    const changeFiles = getChangeFiles(options);
    expect(changeFiles).toHaveLength(1);
  });

  it('creates and commits change files for multiple packages', async () => {
    repo = monorepoFactory.cloneRepository();
    checkOutTestBranch(repo);
    makeMonorepoChanges(repo);

    const { options, context } = getOptionsAndContext();
    const changePromise = change(options, context);

    // use custom values for first package
    expect(logs.mocks.log).toHaveBeenLastCalledWith('Please describe the changes for: pkg-1');
    stdin.emitKey({ name: 'down' });
    await stdin.sendByChar('\n');
    // also verify that the options shown are correct
    expect(stdout.lastOutput()).toMatchInlineSnapshot(`
      "? Describe changes (type or choose one) »
      >   commit 2
          commit 1"
    `);
    await stdin.sendByChar('custom\n');

    // use defaults for second package
    expect(logs.mocks.log).toHaveBeenLastCalledWith('Please describe the changes for: pkg-2');
    await stdin.sendByChar('\n\n');

    await changePromise;

    expect(logs.mocks.log).toHaveBeenLastCalledWith(expect.stringMatching(/^git committed these change files:/));
    expect(repo.status()).toBe('');

    const changeFiles = getChangeFiles(options);
    expect(changeFiles).toHaveLength(2);
    const changeFileContents = changeFiles.map(changeFile => readJson<ChangeFileInfo>(changeFile));
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

    const { options, context } = getOptionsAndContext({
      groupChanges: true,
    });
    const changePromise = change(options, context);

    // use custom values for first package
    expect(logs.mocks.log).toHaveBeenLastCalledWith('Please describe the changes for: pkg-1');
    stdin.emitKey({ name: 'down' });
    await stdin.sendByChar('\n');
    await stdin.sendByChar('custom\n');

    // use defaults for second package
    expect(logs.mocks.log).toHaveBeenLastCalledWith('Please describe the changes for: pkg-2');
    await stdin.sendByChar('\n\n');

    await changePromise;

    expect(logs.mocks.log).toHaveBeenLastCalledWith(expect.stringMatching(/^git committed these change files:/));
    expect(repo.status()).toBe('');

    const changeFiles = getChangeFiles(options);
    expect(changeFiles).toHaveLength(1);
    const contents = readJson<ChangeInfoMultiple>(changeFiles[0]);
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
      changeFilePrompt: {
        changePrompt: (defaultPrompt, pkg) => {
          const questions = [defaultPrompt.changeType!, defaultPrompt.description!];
          return pkg === 'pkg-1'
            ? questions
            : [{ type: 'text', name: 'custom', message: 'custom question' }, ...questions];
        },
      },
    };

    const { options, context } = getOptionsAndContext({
      groupChanges: true,
    });
    const changePromise = change(options, context);
    await waitForPrompt();

    expect(logs.mocks.log).toHaveBeenLastCalledWith('Please describe the changes for: pkg-1');
    expect(stdout.lastOutput()).toMatch(/Change type/);
    await stdin.sendByChar('\n');
    expect(stdout.lastOutput()).toMatch(/Describe changes/);
    await stdin.sendByChar('\n');

    expect(logs.mocks.log).toHaveBeenLastCalledWith('Please describe the changes for: pkg-2');
    expect(stdout.lastOutput()).toMatch(/custom question/);
    await stdin.sendByChar('stuff\n');
    expect(stdout.lastOutput()).toMatch(/Change type/);
    await stdin.sendByChar('\n');
    expect(stdout.lastOutput()).toMatch(/Describe changes/);
    await stdin.sendByChar('\n');

    await changePromise;

    const changeFiles = getChangeFiles(options);
    expect(changeFiles).toHaveLength(1);
    const contents = readJson<ChangeInfoMultiple>(changeFiles[0]);
    expect(contents.changes).toEqual([
      expect.objectContaining({ packageName: 'pkg-1', type: 'patch', comment: 'commit 2' }),
      expect.objectContaining({ packageName: 'pkg-2', type: 'patch', comment: 'commit 2', custom: 'stuff' }),
    ]);
  });

  // custom prompt for different packages (only truly doable here because elsewhere it uses combinedOptions)
});
