import { describe, expect, it, afterEach, jest, beforeEach } from '@jest/globals';
import fs from 'fs-extra';
import type prompts from 'prompts';
import { getChangeFiles } from '../__fixtures__/changeFiles';
import { initMockLogs } from '../__fixtures__/mockLogs';
import { type RepoFixture, RepositoryFactory } from '../__fixtures__/repositoryFactory';
import { change } from '../commands/change';
import type { BeachballOptions, RepoOptions } from '../types/BeachballOptions';
import { defaultRemoteBranchName } from '../__fixtures__/gitDefaults';
import { MockStdout } from '../__fixtures__/mockStdout';
import { MockStdin } from '../__fixtures__/mockStdin';
import type { ChangeFileInfo, ChangeInfoMultiple } from '../types/ChangeInfo';
import type { Repository } from '../__fixtures__/repository';
import { getParsedOptions } from '../options/getOptions';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import { mockProcessExit } from '../__fixtures__/mockProcessExit';

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

describe('change command', () => {
  let repositoryFactory: RepositoryFactory | undefined;
  let repo: Repository | undefined;

  const logs = initMockLogs();
  mockProcessExit();

  function getOptionsAndPackages(repoOptions?: Partial<RepoOptions>, extraArgv?: string[]) {
    const parsedOptions = getParsedOptions({
      cwd: repo!.rootPath,
      argv: ['node', 'beachball', 'change', ...(extraArgv ?? [])],
      testRepoOptions: {
        branch: defaultRemoteBranchName,
        ...repoOptions,
      },
    });
    const packageInfos = getPackageInfos(parsedOptions);
    return { options: parsedOptions.options, packageInfos };
  }

  beforeEach(() => {
    stdin = new MockStdin();
    stdout = new MockStdout({ replace: 'prompts' });
  });

  afterEach(() => {
    stdin.destroy();
    stdout.destroy();
    repositoryFactory?.cleanUp();
    repositoryFactory = undefined;
    repo = undefined;
    mockBeachballOptions = undefined;
  });

  it('does not create change files when there are no changes', async () => {
    repositoryFactory = new RepositoryFactory('single');
    repo = repositoryFactory.cloneRepository();

    const { options, packageInfos } = getOptionsAndPackages();
    await change(options, packageInfos);

    expect(getChangeFiles(options)).toHaveLength(0);
  });

  it('creates and stages a change file', async () => {
    repositoryFactory = new RepositoryFactory('single');
    repo = repositoryFactory.cloneRepository();

    repo.checkout('-b', 'test');
    repo.commitChange('file.js');

    const { options, packageInfos } = getOptionsAndPackages({ commit: false });
    const changePromise = change(options, packageInfos);
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
    expect(fs.readJSONSync(changeFiles[0])).toMatchObject({
      comment: 'stage me please',
      packageName: 'foo',
      type: 'patch',
    });
  });

  it('creates and commits a change file', async () => {
    repositoryFactory = new RepositoryFactory('single');
    repo = repositoryFactory.cloneRepository();

    repo.checkout('-b', 'test');
    repo.commitChange('file.js');

    const { options, packageInfos } = getOptionsAndPackages();
    const changePromise = change(options, packageInfos);

    expect(logs.mocks.log).toHaveBeenLastCalledWith('Please describe the changes for: foo');
    await stdin.sendByChar('\n'); // default change type
    await stdin.sendByChar('commit me please\n'); // custom message
    await changePromise;

    expect(logs.mocks.log).toHaveBeenLastCalledWith(expect.stringMatching(/^git committed these change files:/));
    expect(repo.status()).toBe('');

    const changeFiles = getChangeFiles(options);
    expect(changeFiles).toHaveLength(1);
    expect(fs.readJSONSync(changeFiles[0])).toMatchObject({
      comment: 'commit me please',
      packageName: 'foo',
      type: 'patch',
    });
  });

  it('creates and commits a change file with changeDir set', async () => {
    const testChangedir = 'changeDir';

    repositoryFactory = new RepositoryFactory('single');
    repo = repositoryFactory.cloneRepository();

    repo.checkout('-b', 'test');
    repo.commitChange('file.js');

    const { options, packageInfos } = getOptionsAndPackages({
      changeDir: testChangedir,
    });
    const changePromise = change(options, packageInfos);

    expect(logs.mocks.log).toHaveBeenLastCalledWith('Please describe the changes for: foo');
    await stdin.sendByChar('\n'); // default change type
    await stdin.sendByChar('commit me please\n'); // custom message
    await changePromise;

    expect(logs.mocks.log).toHaveBeenLastCalledWith(expect.stringMatching(/^git committed these change files:/));
    expect(repo.status()).toBe('');

    const changeFiles = getChangeFiles(options);
    expect(changeFiles).toHaveLength(1);
    expect(fs.readJSONSync(changeFiles[0])).toMatchObject({
      comment: 'commit me please',
      packageName: 'foo',
      type: 'patch',
    });
  });

  it('creates a change file when there are no changes but package name is provided', async () => {
    repositoryFactory = new RepositoryFactory('single');
    repo = repositoryFactory.cloneRepository();

    const { options, packageInfos } = getOptionsAndPackages({}, [
      '--package',
      repositoryFactory.fixture.rootPackage.name,
      '--no-commit',
    ]);
    const changePromise = change(options, packageInfos);
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
    repositoryFactory = new RepositoryFactory({ folders: monorepo });
    repo = repositoryFactory.cloneRepository();
    makeMonorepoChanges(repo);

    const { options, packageInfos } = getOptionsAndPackages();
    const changePromise = change(options, packageInfos);

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
    const changeFileContents = changeFiles.map(changeFile => fs.readJSONSync(changeFile) as ChangeFileInfo);
    expect(changeFileContents).toContainEqual(
      expect.objectContaining({ comment: 'custom', packageName: 'pkg-1', type: 'minor' })
    );
    expect(changeFileContents).toContainEqual(
      expect.objectContaining({ comment: 'commit 2', packageName: 'pkg-2', type: 'patch' })
    );
  });

  it('creates and commits grouped change file for multiple packages', async () => {
    repositoryFactory = new RepositoryFactory({ folders: monorepo });
    repo = repositoryFactory.cloneRepository();
    makeMonorepoChanges(repo);

    const { options, packageInfos } = getOptionsAndPackages({
      groupChanges: true,
    });
    const changePromise = change(options, packageInfos);

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
    const contents = fs.readJSONSync(changeFiles[0]) as ChangeInfoMultiple;
    expect(contents.changes).toEqual([
      expect.objectContaining({ comment: 'custom', packageName: 'pkg-1', type: 'minor' }),
      expect.objectContaining({ comment: 'commit 2', packageName: 'pkg-2', type: 'patch' }),
    ]);
  });

  it('uses custom per-package prompt', async () => {
    repositoryFactory = new RepositoryFactory({ folders: monorepo });
    repo = repositoryFactory.cloneRepository();
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

    const { options, packageInfos } = getOptionsAndPackages({
      groupChanges: true,
    });
    const changePromise = change(options, packageInfos);
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
    const contents = fs.readJSONSync(changeFiles[0]) as ChangeInfoMultiple;
    expect(contents.changes).toEqual([
      expect.objectContaining({ packageName: 'pkg-1', type: 'patch', comment: 'commit 2' }),
      expect.objectContaining({ packageName: 'pkg-2', type: 'patch', comment: 'commit 2', custom: 'stuff' }),
    ]);
  });

  // custom prompt for different packages (only truly doable here because elsewhere it uses combinedOptions)
});
