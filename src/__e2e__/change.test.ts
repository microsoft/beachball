import { describe, expect, it, afterEach, jest, beforeEach } from '@jest/globals';
import fs from 'fs-extra';
import type prompts from 'prompts';
import { getChangeFiles } from '../__fixtures__/changeFiles';
import { initMockLogs } from '../__fixtures__/mockLogs';
import { RepoFixture, RepositoryFactory } from '../__fixtures__/repositoryFactory';
import { change } from '../commands/change';
import { BeachballOptions } from '../types/BeachballOptions';
import { defaultBranchName } from '../__fixtures__/gitDefaults';
import { MockStdout } from '../__fixtures__/mockStdout';
import { MockStdin } from '../__fixtures__/mockStdin';
import { ChangeFileInfo } from '../types/ChangeInfo';
import { Repository } from '../__fixtures__/repository';

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
      return (jest.requireActual('prompts') as typeof prompts)(questions, options);
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
    ...(jest.requireActual('../options/getDefaultOptions') as any).getDefaultOptions(),
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

  const logs = initMockLogs();

  beforeEach(() => {
    stdin = new MockStdin();
    stdout = new MockStdout({ replace: 'prompts' });
  });

  afterEach(() => {
    stdin.destroy();
    stdout.destroy();
    repositoryFactory?.cleanUp();
    repositoryFactory = undefined;
    mockBeachballOptions = undefined;
  });

  it('does not create change files when there are no changes', async () => {
    repositoryFactory = new RepositoryFactory('single');
    const repo = repositoryFactory.cloneRepository();

    await change({ path: repo.rootPath, branch: defaultBranchName } as BeachballOptions);

    expect(getChangeFiles(repo.rootPath)).toHaveLength(0);
  });

  it('creates and stages a change file', async () => {
    repositoryFactory = new RepositoryFactory('single');
    const repo = repositoryFactory.cloneRepository();

    repo.checkout('-b', 'test');
    repo.commitChange('file.js');

    const changePromise = change({ path: repo.rootPath, branch: defaultBranchName, commit: false } as BeachballOptions);
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

    const changeFiles = getChangeFiles(repo.rootPath);
    expect(changeFiles).toHaveLength(1);
    expect(fs.readJSONSync(changeFiles[0])).toMatchObject({
      comment: 'stage me please',
      packageName: 'foo',
      type: 'patch',
    });
  });

  it('creates and commits a change file', async () => {
    repositoryFactory = new RepositoryFactory('single');
    const repo = repositoryFactory.cloneRepository();

    repo.checkout('-b', 'test');
    repo.commitChange('file.js');

    const changePromise = change({ path: repo.rootPath, branch: defaultBranchName } as BeachballOptions);

    expect(logs.mocks.log).toHaveBeenLastCalledWith('Please describe the changes for: foo');
    await stdin.sendByChar('\n'); // default change type
    await stdin.sendByChar('commit me please\n'); // custom message
    await changePromise;

    expect(logs.mocks.log).toHaveBeenLastCalledWith(expect.stringMatching(/^git committed these change files:/));
    expect(repo.status()).toBe('');

    const changeFiles = getChangeFiles(repo.rootPath);
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
    const repo = repositoryFactory.cloneRepository();

    repo.checkout('-b', 'test');
    repo.commitChange('file.js');

    const changePromise = change({
      path: repo.rootPath,
      branch: defaultBranchName,
      changeDir: testChangedir,
    } as BeachballOptions);

    expect(logs.mocks.log).toHaveBeenLastCalledWith('Please describe the changes for: foo');
    await stdin.sendByChar('\n'); // default change type
    await stdin.sendByChar('commit me please\n'); // custom message
    await changePromise;

    expect(logs.mocks.log).toHaveBeenLastCalledWith(expect.stringMatching(/^git committed these change files:/));
    expect(repo.status()).toBe('');

    const changeFiles = getChangeFiles(repo.rootPath, testChangedir);
    expect(changeFiles).toHaveLength(1);
    expect(fs.readJSONSync(changeFiles[0])).toMatchObject({
      comment: 'commit me please',
      packageName: 'foo',
      type: 'patch',
    });
  });

  it('creates a change file when there are no changes but package name is provided', async () => {
    repositoryFactory = new RepositoryFactory('single');
    const repo = repositoryFactory.cloneRepository();

    const changePromise = change({
      package: repositoryFactory.fixture.rootPackage!.name,
      path: repo.rootPath,
      branch: defaultBranchName,
      commit: false,
    } as BeachballOptions);
    await waitForPrompt();

    expect(logs.mocks.log).toHaveBeenLastCalledWith('Please describe the changes for: foo');
    await stdin.sendByChar('\n'); // default change type
    await stdin.sendByChar('stage me please\n'); // custom message
    await changePromise;

    expect(repo.status()).toMatch(/^A  change/);

    const changeFiles = getChangeFiles(repo.rootPath);
    expect(changeFiles).toHaveLength(1);
  });

  it('creates and commits change files for multiple packages', async () => {
    repositoryFactory = new RepositoryFactory({ folders: monorepo });
    const repo = repositoryFactory.cloneRepository();
    makeMonorepoChanges(repo);

    const changePromise = change({ path: repo.rootPath, branch: defaultBranchName } as BeachballOptions);

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

    const changeFiles = getChangeFiles(repo.rootPath);
    expect(changeFiles).toHaveLength(2);
    const changeFileContents = changeFiles.map(changeFile => fs.readJSONSync(changeFile)) as ChangeFileInfo[];
    expect(changeFileContents).toContainEqual(
      expect.objectContaining({ comment: 'custom', packageName: 'pkg-1', type: 'minor' })
    );
    expect(changeFileContents).toContainEqual(
      expect.objectContaining({ comment: 'commit 2', packageName: 'pkg-2', type: 'patch' })
    );
  });

  it('creates and commits grouped change file for multiple packages', async () => {
    repositoryFactory = new RepositoryFactory({ folders: monorepo });
    const repo = repositoryFactory.cloneRepository();
    makeMonorepoChanges(repo);

    const changePromise = change({
      path: repo.rootPath,
      branch: defaultBranchName,
      groupChanges: true,
    } as BeachballOptions);

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

    const changeFiles = getChangeFiles(repo.rootPath);
    expect(changeFiles).toHaveLength(1);
    const contents = fs.readJSONSync(changeFiles[0]);
    expect(contents.changes).toEqual([
      expect.objectContaining({ comment: 'custom', packageName: 'pkg-1', type: 'minor' }),
      expect.objectContaining({ comment: 'commit 2', packageName: 'pkg-2', type: 'patch' }),
    ]);
  });

  it('uses custom per-package prompt', async () => {
    repositoryFactory = new RepositoryFactory({ folders: monorepo });
    const repo = repositoryFactory.cloneRepository();
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

    const changePromise = change({
      path: repo.rootPath,
      branch: defaultBranchName,
      groupChanges: true,
    } as BeachballOptions);
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

    const changeFiles = getChangeFiles(repo.rootPath);
    expect(changeFiles).toHaveLength(1);
    const contents = fs.readJSONSync(changeFiles[0]);
    expect(contents.changes).toEqual([
      expect.objectContaining({ packageName: 'pkg-1', type: 'patch', comment: 'commit 2' }),
      expect.objectContaining({ packageName: 'pkg-2', type: 'patch', comment: 'commit 2', custom: 'stuff' }),
    ]);
  });

  // custom prompt for different packages (only truly doable here because elsewhere it uses combinedOptions)
});
