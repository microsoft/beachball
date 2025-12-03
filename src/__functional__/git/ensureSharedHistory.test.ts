import { describe, expect, it, beforeAll, afterAll, jest, afterEach } from '@jest/globals';
import * as workspaceTools from 'workspace-tools';
import { RepositoryFactory } from '../../__fixtures__/repositoryFactory';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { ensureSharedHistory } from '../../git/ensureSharedHistory';
import { defaultBranchName, defaultRemoteBranchName, optsWithLang } from '../../__fixtures__/gitDefaults';

// required for `jest.spyOn(workspaceTools, git)` to work
jest.mock('workspace-tools', () => {
  const original = jest.requireActual<typeof workspaceTools>('workspace-tools');
  return {
    ...original,
    git: jest.fn(original.git),
  };
});

describe('ensureSharedHistory', () => {
  let repositoryFactory: RepositoryFactory;
  const logs = initMockLogs();
  const testBranch = 'test';

  const realGit = jest.requireActual<typeof workspaceTools>('workspace-tools').git;
  /**
   * Set this to override the git implementation for one test.
   * (Use this instead of `.mockImplementation()` to avoid interference with other mocks.)
   */
  let gitOverride: typeof workspaceTools.git | undefined;
  const gitSpy = jest
    .spyOn(workspaceTools, 'git')
    // Attempt to force git to use English in logs, so we can check for absence of "warning" strings
    .mockImplementation((args, opts) => (gitOverride || realGit)(args, opts && optsWithLang(opts)));

  /**
   * Get git spy calls, by default ignoring rev-parse (does ref exist/is shallow repo?)
   * and merge-base (has shared history?). Pass an empty array to return all calls.
   */
  function filteredGitCalls(ignorePrefixes: string[] = ['rev-parse', 'merge-base']) {
    const calls = gitSpy.mock.calls.map(call => call[0].join(' '));
    if (!ignorePrefixes.length) {
      return calls;
    }
    const ignoreRegex = new RegExp(`^(${ignorePrefixes.join('|')})`);
    return calls.filter(call => !ignoreRegex.test(call));
  }

  beforeAll(() => {
    repositoryFactory = new RepositoryFactory('single');
    const repo = repositoryFactory.cloneRepository();

    // Make several commits in a branch, so that if the repo is shallow cloned with only this branch,
    // it will be necessary to fetch more history to compare with the default branch
    repo.checkout('-b', testBranch);
    ['a', 'b', 'c', 'd', 'e'].forEach(name => repo.commitChange(`${name}.js`));
    repo.push(testBranch);

    // Make one divergent change in the default branch
    // (the shared history check should work even if the branches are out of sync)
    repo.checkout(defaultBranchName);
    repo.commitChange('f.js');
    repo.push(defaultBranchName);
  });

  afterEach(() => {
    gitOverride = undefined;
    gitSpy.mockClear();
  });

  afterAll(() => {
    repositoryFactory.cleanUp();
    gitSpy.mockRestore();
  });

  it('fetches and succeeds if adequate history is available', () => {
    const repo = repositoryFactory.cloneRepository();
    repo.checkout(testBranch);
    gitSpy.mockClear();

    ensureSharedHistory({ path: repo.rootPath, verbose: true, branch: defaultRemoteBranchName, fetch: true });
    // Ensure the expected git calls were made
    expect(filteredGitCalls()).toEqual(['fetch origin master']);

    const allLogs = logs.getMockLines('all');
    expect(allLogs).toMatch('Fetching branch "master" from remote "origin"...');
    expect(allLogs).toMatch('Fetching branch "master" from remote "origin" completed successfully');
    expect(allLogs).not.toMatch('warning');
  });

  it('fetches and succeeds if remote is not specified but local branch is available', () => {
    const repo = repositoryFactory.cloneRepository();
    repo.checkout(testBranch);
    gitSpy.mockClear();

    ensureSharedHistory({ path: repo.rootPath, verbose: true, branch: defaultBranchName, fetch: true });
    expect(filteredGitCalls()).toContain('fetch');

    const allLogs = logs.getMockLines('all');
    expect(allLogs).toMatch('Fetching all remotes...');
    expect(allLogs).toMatch('Fetching all remotes completed successfully');
    expect(allLogs).not.toMatch('warning');
  });

  it('succeeds with fetching disabled if adequate history is available', () => {
    const repo = repositoryFactory.cloneRepository();
    repo.checkout(testBranch);
    gitSpy.mockClear();

    ensureSharedHistory({ path: repo.rootPath, verbose: true, branch: defaultRemoteBranchName, fetch: false });
    expect(filteredGitCalls()).not.toContain(expect.stringMatching(/^fetch/));
    expect(logs.getMockLines('all')).toEqual('');
  });

  it('omits depth option from main fetch in non-shallow repo', () => {
    // If a repo is NOT a shallow clone and git fetch is run with --depth, it will be converted to
    // a shallow repo. This is likely not desirable, so depth should be omitted from the main fetch.
    // Note that in a shallow repo, it will remain shallow even if --depth is omitted.
    const repo = repositoryFactory.cloneRepository();
    repo.checkout(testBranch);
    gitSpy.mockClear();

    ensureSharedHistory({ path: repo.rootPath, verbose: true, branch: defaultRemoteBranchName, fetch: true, depth: 1 });
    expect(filteredGitCalls()).toEqual(['fetch origin master']);
  });

  it('errors if fetching is disabled and target branch does not exist locally', () => {
    const repo = repositoryFactory.cloneRepository({ depth: 1, branch: testBranch, singleBranch: true });
    gitSpy.mockClear();

    expect(() =>
      ensureSharedHistory({ path: repo.rootPath, verbose: true, branch: defaultRemoteBranchName, fetch: false })
    ).toThrow('Target branch "origin/master" does not exist locally, and fetching is disabled');
    expect(filteredGitCalls()).not.toContain(expect.stringMatching(/^fetch/));
    expect(logs.getMockLines('error')).toMatchInlineSnapshot(`
      "Target branch "origin/master" does not exist locally, and fetching is disabled.

      Some possible fixes:
        • Fetch the branch manually:
            git remote set-branches --add origin master && git fetch origin
        • Omit the "--no-fetch" / "--fetch=false" option from the command line
        • Remove "fetch: false" from the beachball config
        • If this is a CI build, ensure that adequate history is being fetched
          ▪ For GitHub Actions (actions/checkout), add the option "fetch-depth: 0" in the checkout step."
    `);
  });

  it('errors if remote is not specified and target branch does not exist locally', () => {
    const repo = repositoryFactory.cloneRepository({ depth: 1, branch: testBranch, singleBranch: true });
    gitSpy.mockClear();

    expect(() =>
      ensureSharedHistory({ path: repo.rootPath, verbose: true, branch: defaultBranchName, fetch: true })
    ).toThrow(
      `Target branch "master" doesn't exist locally, and a remote name wasn't specified and couldn't be inferred. ` +
        `Please set "repository" in your root package.json or include a remote in the beachball "branch" setting.`
    );
    expect(filteredGitCalls()).not.toContain(expect.stringMatching(/^fetch/));
    expect(logs.getMockLines('all')).toEqual('');
  });

  it('errors if fetching fails even if the branch exists locally', () => {
    const repo = repositoryFactory.cloneRepository();
    repo.checkout(testBranch);
    gitSpy.mockClear();

    // this simulates a network error or something
    gitOverride = (...args) =>
      args[0][0] === 'fetch' ? ({ success: false } as workspaceTools.GitProcessOutput) : realGit(...args);

    expect(() =>
      ensureSharedHistory({ path: repo.rootPath, verbose: true, branch: defaultRemoteBranchName, fetch: true })
    ).toThrow('Fetching branch "master" from remote "origin" failed');
    expect(filteredGitCalls()).toContain('fetch origin master');

    const allLogs = logs.getMockLines('all');
    expect(allLogs).toMatch('Fetching branch "master" from remote "origin"...');
    expect(allLogs).toMatch('Fetching branch "master" from remote "origin" failed');
  });

  it('errors if target branch does not exist locally or on remote (normal clone)', () => {
    const repo = repositoryFactory.cloneRepository({ branch: testBranch });
    gitSpy.mockClear();

    expect(() =>
      ensureSharedHistory({ path: repo.rootPath, verbose: false, branch: 'origin/fake', fetch: true })
    ).toThrow('Fetching branch "fake" from remote "origin" failed');
    const gitOps = filteredGitCalls();
    expect(gitOps).not.toContain('remote set-branches --add origin fake');
    expect(gitOps).toContain('fetch origin fake');

    expect(logs.getMockLines('all')).toEqual('');
  });

  it('errors if target branch does not exist locally or on remote (single branch clone)', () => {
    const repo = repositoryFactory.cloneRepository({ branch: testBranch, singleBranch: true });
    gitSpy.mockClear();

    expect(() =>
      ensureSharedHistory({ path: repo.rootPath, verbose: true, branch: 'origin/fake', fetch: true })
    ).toThrow('Fetching branch "fake" from remote "origin" failed');

    const gitOps = filteredGitCalls();
    expect(gitOps).toContain('remote set-branches --add origin fake');
    expect(gitOps).toContain('fetch origin fake');

    const allLogs = logs.getMockLines('all');
    expect(allLogs).toMatch('Adding branch "fake" to fetch config for remote "origin"');
    expect(allLogs).toMatch('Fetching branch "fake" from remote "origin"...');
  });

  it('errors if fetching is disabled and adequate history is not available', () => {
    // singleBranch: false is necessary to fetch other branches when depth is set
    const repo = repositoryFactory.cloneRepository({ depth: 1, branch: testBranch, singleBranch: false });
    gitSpy.mockClear();

    expect(() =>
      ensureSharedHistory({ path: repo.rootPath, verbose: true, branch: defaultRemoteBranchName, fetch: false })
    ).toThrow('Inadequate history available to connect HEAD to target branch "origin/master"');
    expect(filteredGitCalls()).not.toContain(expect.stringMatching(/^fetch/));
    expect(logs.getMockLines('error')).toMatchInlineSnapshot(`
      "This repo is a shallow clone, fetching is disabled, and not enough history is available to connect HEAD to "origin/master".

      Some possible fixes:
        • Verify that you're using the correct target branch
        • Unshallow or deepen the clone manually
        • Omit the "--no-fetch" / "--fetch=false" option from the command line
        • Remove "fetch: false" from the beachball config
        • If this is a CI build, ensure that adequate history is being fetched
          ▪ For GitHub Actions (actions/checkout), add the option "fetch-depth: 0" in the checkout step."
    `);
  });

  it('deepens history if needed', () => {
    const repo = repositoryFactory.cloneRepository({ depth: 1, branch: testBranch, singleBranch: true });
    gitSpy.mockClear();

    ensureSharedHistory({
      path: repo.rootPath,
      branch: defaultRemoteBranchName,
      fetch: true,
      depth: 2,
      // Run this with verbose git logs so we can verify arguments were correct (no "warning" logs).
      // However, this adds noise including filesystem paths to the output, so we can't snapshot it.
      verbose: true,
    });

    const allLogs = logs.getMockLines('all');
    expect(allLogs).toMatch('Adding branch "master" to fetch config for remote "origin"');
    expect(allLogs).toMatch('This is a shallow clone. Deepening to check for changes...');
    expect(allLogs).toMatch('Deepening by 2 more commits (attempt 1/3)...');
    expect(allLogs).toMatch('Deepening by 2 more commits (attempt 2/3)...');
    expect(allLogs).toMatch('Deepening by 2 more commits (attempt 3/3)...');
    expect(allLogs).not.toMatch('warning');
    expect(logs.mocks.warn).not.toHaveBeenCalled();
    expect(logs.mocks.error).not.toHaveBeenCalled();

    expect(filteredGitCalls().filter(line => !line.startsWith('rev-parse') && !line.startsWith('merge-base')))
      .toMatchInlineSnapshot(`
      [
        "config --get-all remote.origin.fetch",
        "remote set-branches --add origin master",
        "fetch --depth=2 origin master",
        "fetch --deepen=2 origin master",
        "fetch --deepen=2 origin master",
        "fetch --deepen=2 origin master",
      ]
    `);
  });

  it('unshallows if deepening attempts fail', () => {
    const repo = repositoryFactory.cloneRepository({ depth: 1, branch: testBranch, singleBranch: true });
    gitSpy.mockClear();

    // This deepens by 1 commit at a time with 3 attempts, which isn't enough to get the connecting history
    ensureSharedHistory({
      path: repo.rootPath,
      verbose: false, // prevent temp paths in logs
      branch: defaultRemoteBranchName,
      fetch: true,
      depth: 1,
    });

    expect(logs.getMockLines('all')).toMatch("Still didn't find a common commit after deepening by 3. Unshallowing...");
    expect(filteredGitCalls()).toMatchInlineSnapshot(`
      [
        "config --get-all remote.origin.fetch",
        "remote set-branches --add origin master",
        "fetch --depth=1 origin master",
        "fetch --deepen=1 origin master",
        "fetch --deepen=1 origin master",
        "fetch --deepen=1 origin master",
        "fetch --unshallow origin master",
      ]
    `);
  });

  it('errors if there is no common history', () => {
    const repo = repositoryFactory.cloneRepository();
    // Make a separate branch with unrelated history
    const separateBranch = 'separate';
    repo.checkout('--orphan', separateBranch);
    repo.commitAll('separate history');
    repo.push(separateBranch);
    gitSpy.mockClear();

    // This call only deepens by 1 commit at a time, with 3 attempts,
    // which isn't enough to get the connecting history
    expect(() =>
      ensureSharedHistory({ path: repo.rootPath, verbose: true, branch: defaultRemoteBranchName, fetch: true })
    ).toThrow('HEAD does not appear to share history with target branch "origin/master"');

    // The fetch part succeeded
    const allLogs = logs.getMockLines('all');
    expect(allLogs).toMatch('Fetching branch "master" from remote "origin"...');
    expect(allLogs).toMatch('Fetching branch "master" from remote "origin" completed successfully');

    expect(filteredGitCalls([])).toEqual([
      'rev-parse --verify origin/master',
      'fetch origin master',
      'merge-base origin/master HEAD',
      'rev-parse --is-shallow-repository',
    ]);
  });
});
