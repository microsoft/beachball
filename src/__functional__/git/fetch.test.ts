import { describe, expect, it, beforeAll, afterAll, jest, afterEach } from '@jest/globals';
import * as workspaceTools from 'workspace-tools';
import { RepositoryFactory } from '../../__fixtures__/repositoryFactory';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import type { Repository } from '../../__fixtures__/repository';
import { gitFetch } from '../../git/fetch';
import { defaultBranchName, defaultRemoteName } from '../../__fixtures__/gitDefaults';
import type { GitProcessOutput } from 'workspace-tools';

// required for `jest.spyOn('workspace-tools', git)` to work
jest.mock('workspace-tools', () => {
  const original = jest.requireActual<typeof workspaceTools>('workspace-tools');
  return {
    ...original,
    git: jest.fn(original.git),
  };
});

describe('gitFetch', () => {
  let repositoryFactory: RepositoryFactory;
  let repo: Repository;
  let realRemoteUrl = '';
  let modifiedRemote = false;

  const logs = initMockLogs();

  /** To speed things up, some tests only check the arguments and skip the git operation */
  const noOpSuccess = () => ({ success: true, stdout: '', stderr: '', status: 0 }) as GitProcessOutput;

  const realGit = jest.requireActual<typeof workspaceTools>('workspace-tools').git;
  /**
   * Set this to override the git implementation for one test.
   * (Use this instead of `.mockImplementation()` to avoid interference with other mocks.)
   */
  let gitOverride: typeof realGit | undefined;
  const gitSpy = jest.spyOn(workspaceTools, 'git').mockImplementation((...args) => (gitOverride || realGit)(...args));

  beforeAll(() => {
    repositoryFactory = new RepositoryFactory('single');
    repo = repositoryFactory.cloneRepository();
    realRemoteUrl = repo.git(['remote', 'get-url', defaultRemoteName]).stdout.trim();
    gitSpy.mockClear();
  });

  afterEach(() => {
    gitOverride = undefined;
    if (modifiedRemote) {
      repo.git(['remote', 'set-url', defaultRemoteName, realRemoteUrl]);
      modifiedRemote = false;
    }
    gitSpy.mockClear();
  });

  afterAll(() => {
    repositoryFactory.cleanUp();
    gitSpy.mockRestore();
  });

  it('throws if mutually exclusive options are specified', () => {
    const err = '"depth", "deepen", and "unshallow" are mutually exclusive';
    // use 0 for all of the depth/deepen values to verify it's not using falsy checks
    expect(() => gitFetch({ cwd: '', depth: 0, deepen: 0 })).toThrow(err);
    expect(() => gitFetch({ cwd: '', depth: 0, unshallow: true })).toThrow(err);
    expect(() => gitFetch({ cwd: '', deepen: 0, unshallow: true })).toThrow(err);
    expect(() => gitFetch({ cwd: '', depth: 0, deepen: 0, unshallow: true })).toThrow(err);
    expect(gitSpy).not.toHaveBeenCalled();
  });

  it('fetches and does not log by default', () => {
    const res = gitFetch({ cwd: repo.rootPath });
    expect(gitSpy).toHaveBeenCalledWith(['fetch'], { cwd: repo.rootPath, stdio: 'pipe' });
    expect(res.success).toBe(true);
    expect(logs.mocks.log).not.toHaveBeenCalled();
  });

  it('returns error but does not throw or log on failure by default', () => {
    // This test uses controlled non-localized fake stdio so we can test the whole output
    gitOverride = () => ({ success: false, stdout: 'some logs', stderr: 'oh no', status: 1 }) as GitProcessOutput;

    const res = gitFetch({ cwd: repo.rootPath });
    expect(res).toEqual(
      expect.objectContaining({
        success: false,
        errorMessage: ['Fetching all remotes failed (code 1)', 'stdout:', 'some logs', 'stderr:', 'oh no'].join('\n'),
        status: 1,
        stderr: 'oh no',
        stdout: 'some logs',
      })
    );
    expect(logs.mocks.log).not.toHaveBeenCalled();
  });

  it('returns error but does not throw if remote is invalid', () => {
    repo.git(['remote', 'set-url', defaultRemoteName, 'invalid-url']);
    modifiedRemote = true;

    const res = gitFetch({ cwd: repo.rootPath });
    expect(res.success).toBe(false);
    expect(res.errorMessage).toContain('Fetching all remotes failed (code 128)');
    // The URL is the only part of the error message that isn't localized
    expect(res.stderr).toContain('invalid-url');
    expect(res.errorMessage).toContain('invalid-url');
  });

  it('logs git output if verbose is true', () => {
    // use predictable output
    gitOverride = () => ({ ...noOpSuccess(), stdout: 'some logs', stderr: 'some debug' });

    const res = gitFetch({ cwd: repo.rootPath, verbose: true });
    // normally this would be called with stdio: inherit, but it's not done that way in tests
    // because process.stdout/stderr can't be mocked, so the test output would be too spammy
    expect(gitSpy).toHaveBeenCalledWith(['fetch'], expect.anything());
    expect(res.success).toBe(true);
    expect(res.errorMessage).toBeUndefined();
    expect(logs.mocks.log).toHaveBeenCalledWith('Fetching all remotes...');
    expect(logs.mocks.log).toHaveBeenCalledWith('some logs');
    expect(logs.mocks.log).toHaveBeenCalledWith('some debug');
    expect(logs.mocks.log).toHaveBeenCalledWith('Fetching all remotes completed successfully');
  });

  it('logs git output with failed fetch if verbose is true', () => {
    gitOverride = () => ({ success: false, stdout: 'some logs', stderr: 'oh no', status: 1 }) as GitProcessOutput;

    const res = gitFetch({ cwd: repo.rootPath, verbose: true });
    expect(gitSpy).toHaveBeenCalledWith(['fetch'], expect.anything());
    expect(res).toEqual(
      expect.objectContaining({
        success: false,
        errorMessage: 'Fetching all remotes failed (code 1) - see above for details',
        status: 1,
      })
    );
    expect(logs.mocks.log).toHaveBeenCalledWith('Fetching all remotes...');
    expect(logs.mocks.log).toHaveBeenCalledWith('some logs');
    expect(logs.mocks.warn).toHaveBeenCalledWith('oh no');
    expect(logs.mocks.warn).toHaveBeenCalledWith('Fetching all remotes failed (code 1)');
  });

  it('fetches remote if specified', () => {
    gitOverride = noOpSuccess;
    const res = gitFetch({ cwd: repo.rootPath, remote: defaultRemoteName, verbose: true });

    expect(gitSpy).toHaveBeenCalledWith(['fetch', defaultRemoteName], expect.anything());
    expect(res.success).toBe(true);
    expect(logs.mocks.log).toHaveBeenCalledWith(`Fetching remote "${defaultRemoteName}"...`);
  });

  it('fetches remote and branch if specified', () => {
    gitOverride = noOpSuccess;
    const res = gitFetch({ cwd: repo.rootPath, remote: defaultRemoteName, branch: defaultBranchName, verbose: true });

    expect(gitSpy).toHaveBeenCalledWith(['fetch', defaultRemoteName, defaultBranchName], expect.anything());
    expect(res.success).toBe(true);
    expect(logs.mocks.log).toHaveBeenCalledWith(
      `Fetching branch "${defaultBranchName}" from remote "${defaultRemoteName}"...`
    );
  });

  it('ignores branch if remote is not specified', () => {
    gitOverride = noOpSuccess;
    const res = gitFetch({ cwd: repo.rootPath, branch: defaultBranchName, verbose: true });

    expect(gitSpy).toHaveBeenCalledWith(['fetch'], expect.anything());
    expect(res.success).toBe(true);
    expect(logs.mocks.log).toHaveBeenCalledWith(`Fetching all remotes...`);
  });

  it('respects depth option', () => {
    gitOverride = noOpSuccess;
    const res = gitFetch({ cwd: repo.rootPath, depth: 1, verbose: true });

    expect(gitSpy).toHaveBeenCalledWith(['fetch', '--depth=1'], expect.anything());
    expect(res.success).toBe(true);
    expect(logs.mocks.log).toHaveBeenCalledWith(`Fetching all remotes (with --depth=1)...`);
  });

  it('respects deepen option', () => {
    gitOverride = noOpSuccess;
    const res = gitFetch({ cwd: repo.rootPath, deepen: 1, verbose: true });

    expect(gitSpy).toHaveBeenCalledWith(['fetch', '--deepen=1'], expect.anything());
    expect(res.success).toBe(true);
    expect(logs.mocks.log).toHaveBeenCalledWith(`Fetching all remotes (with --deepen=1)...`);
  });

  it('respects unshallow option', () => {
    gitOverride = noOpSuccess;
    const res = gitFetch({ cwd: repo.rootPath, unshallow: true, verbose: true });

    expect(gitSpy).toHaveBeenCalledWith(['fetch', '--unshallow'], expect.anything());
    expect(res.success).toBe(true);
    expect(logs.mocks.log).toHaveBeenCalledWith(`Fetching all remotes (with --unshallow)...`);
  });
});
