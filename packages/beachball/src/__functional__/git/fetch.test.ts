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

  const { git: realGit, gitFailFast: _realGitFailFast } = jest.requireActual<typeof workspaceTools>('workspace-tools');
  const gitFailFast: typeof _realGitFailFast = (args, options) =>
    _realGitFailFast(args, { cwd: '', ...options, noExitCode: true });

  /**
   * Set this to override the git implementation for one test.
   * (Use this instead of `.mockImplementation()` to avoid interference with other mocks.)
   */
  let gitOverride: typeof realGit | undefined;
  const gitSpy = (workspaceTools.git as jest.MockedFunction<typeof realGit>).mockImplementation((...args) =>
    (gitOverride || realGit)(...args)
  );

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
    const common = { cwd: '', remote: '', branch: defaultBranchName };
    // use 0 for all of the depth/deepen values to verify it's not using falsy checks
    expect(() => gitFetch({ ...common, depth: 0, deepen: 0 })).toThrow(err);
    expect(() => gitFetch({ ...common, depth: 0, unshallow: true })).toThrow(err);
    expect(() => gitFetch({ ...common, deepen: 0, unshallow: true })).toThrow(err);
    expect(() => gitFetch({ ...common, depth: 0, deepen: 0, unshallow: true })).toThrow(err);
    expect(gitSpy).not.toHaveBeenCalled();
  });

  it('fetches and does not log by default', () => {
    const res = gitFetch({ cwd: repo.rootPath, remote: '', branch: defaultBranchName });
    expect(gitSpy).toHaveBeenCalledWith(['fetch'], { cwd: repo.rootPath, stdio: 'pipe' });
    expect(res).toMatchObject({ success: true });
    expect(logs.mocks.log).not.toHaveBeenCalled();
  });

  it('returns error but does not throw or log on failure by default', () => {
    // This test uses controlled non-localized fake stdio so we can test the whole output
    gitOverride = () => ({ success: false, stdout: 'some logs', stderr: 'oh no', status: 1 }) as GitProcessOutput;

    const res = gitFetch({ cwd: repo.rootPath, remote: '', branch: defaultBranchName });
    expect(res).toMatchObject({
      success: false,
      errorMessage: ['Fetching all remotes failed (code 1)', 'stdout:', 'some logs', 'stderr:', 'oh no'].join('\n'),
      status: 1,
      stderr: 'oh no',
      stdout: 'some logs',
    });
    expect(logs.mocks.log).not.toHaveBeenCalled();
  });

  it('returns error but does not throw if remote is invalid', () => {
    repo.git(['remote', 'set-url', defaultRemoteName, 'invalid-url']);
    modifiedRemote = true;

    const res = gitFetch({ cwd: repo.rootPath, branch: defaultBranchName, remote: '' });
    expect(res).toMatchObject({
      success: false,
      errorMessage: expect.stringContaining('Fetching all remotes failed (code 128)'),
      // The URL is the only part of the error message that isn't localized
      stderr: expect.stringContaining('invalid-url'),
    });
    expect(res.errorMessage).toContain('invalid-url');
  });

  it('logs git output if verbose is true', () => {
    // use predictable output
    gitOverride = () => ({ ...noOpSuccess(), stdout: 'some logs', stderr: 'some debug' });

    const res = gitFetch({ cwd: repo.rootPath, verbose: true, remote: '', branch: defaultBranchName });
    // normally this would be called with stdio: inherit, but it's not done that way in tests
    // because process.stdout/stderr can't be mocked, so the test output would be too spammy
    expect(gitSpy).toHaveBeenCalledWith(['fetch'], expect.anything());
    expect(res).toMatchObject({ success: true });
    expect(res.errorMessage).toBeUndefined();
    expect(logs.mocks.log).toHaveBeenCalledWith('Fetching all remotes...');
    expect(logs.mocks.log).toHaveBeenCalledWith('some logs');
    expect(logs.mocks.log).toHaveBeenCalledWith('some debug');
    expect(logs.mocks.log).toHaveBeenCalledWith('Fetching all remotes completed successfully');
  });

  it('logs git output with failed fetch if verbose is true', () => {
    gitOverride = () => ({ success: false, stdout: 'some logs', stderr: 'oh no', status: 1 }) as GitProcessOutput;

    const res = gitFetch({ cwd: repo.rootPath, verbose: true, remote: '', branch: defaultBranchName });
    expect(gitSpy).toHaveBeenCalledWith(['fetch'], expect.anything());
    expect(res).toMatchObject({
      success: false,
      errorMessage: 'Fetching all remotes failed (code 1) - see above for details',
      status: 1,
    });
    expect(logs.mocks.log).toHaveBeenCalledWith('Fetching all remotes...');
    expect(logs.mocks.log).toHaveBeenCalledWith('some logs');
    expect(logs.mocks.warn).toHaveBeenCalledWith('oh no');
    expect(logs.mocks.warn).toHaveBeenCalledWith('Fetching all remotes failed (code 1)');
  });

  it('fetches remote and branch if specified', () => {
    gitOverride = noOpSuccess;
    const res = gitFetch({ cwd: repo.rootPath, remote: defaultRemoteName, branch: defaultBranchName, verbose: true });

    // refs/heads/ on the source side is unambiguous: bare branch names can be silently
    // misresolved, causing git to treat the ref as absent and delete the local tracking ref.
    const refspec = `+refs/heads/${defaultBranchName}:refs/remotes/${defaultRemoteName}/${defaultBranchName}`;
    expect(gitSpy).toHaveBeenCalledWith(['fetch', defaultRemoteName, refspec], expect.anything());
    expect(res).toMatchObject({ success: true });
    expect(logs.mocks.log).toHaveBeenCalledWith(
      `Fetching branch "${defaultBranchName}" from remote "${defaultRemoteName}" (${refspec})...`
    );
  });

  it('preserves the tracking ref after a real fetch', () => {
    // With a bare branch name like 'master' as the refspec source, git can fail to resolve it
    // on the remote and treat it as absent, pruning refs/remotes/origin/master (exit code 0).
    // Using refs/heads/ avoids this. This test runs a real fetch to catch any regression.
    const res = gitFetch({ cwd: repo.rootPath, remote: defaultRemoteName, branch: defaultBranchName });
    expect(res).toMatchObject({ success: true });

    const trackingRef = `refs/remotes/${defaultRemoteName}/${defaultBranchName}`;
    gitFailFast(['rev-parse', '--verify', trackingRef], { cwd: repo.rootPath });
    gitFailFast(['merge-base', `${defaultRemoteName}/${defaultBranchName}`, 'HEAD'], { cwd: repo.rootPath });
  });

  it('only updates the fetched remote tracking ref in a fork-like scenario', () => {
    // Fork setup: 'origin' is the fork, 'upstream' is the original repo.
    // Local master may track upstream, not origin. Fetching from origin must only update
    // refs/remotes/origin/*, and must not touch refs/remotes/upstream/* or refs/heads/*.
    const forkRepo = repositoryFactory.cloneRepository();
    forkRepo.git(['remote', 'add', 'upstream', realRemoteUrl]);
    forkRepo.git(['fetch', 'upstream']);

    const upstreamTrackingRef = `refs/remotes/upstream/${defaultBranchName}`;
    const upstreamShaBefore = realGit(['rev-parse', upstreamTrackingRef], { cwd: forkRepo.rootPath }).stdout.trim();
    const localBranchShaBefore = realGit(['rev-parse', `refs/heads/${defaultBranchName}`], {
      cwd: forkRepo.rootPath,
    }).stdout.trim();
    expect(upstreamShaBefore).toBeTruthy();

    gitSpy.mockClear();
    const res = gitFetch({ cwd: forkRepo.rootPath, remote: defaultRemoteName, branch: defaultBranchName });
    expect(res).toMatchObject({ success: true });

    // The fetch command must target only origin with the correct refspec
    const expectedRefspec = `+refs/heads/${defaultBranchName}:refs/remotes/${defaultRemoteName}/${defaultBranchName}`;
    expect(gitSpy).toHaveBeenCalledWith(['fetch', defaultRemoteName, expectedRefspec], expect.anything());

    // origin/master must exist and be reachable
    gitFailFast(['rev-parse', '--verify', `refs/remotes/${defaultRemoteName}/${defaultBranchName}`], {
      cwd: forkRepo.rootPath,
    });
    gitFailFast(['merge-base', `${defaultRemoteName}/${defaultBranchName}`, 'HEAD'], { cwd: forkRepo.rootPath });

    // upstream/master must be completely unaffected
    const upstreamShaAfter = realGit(['rev-parse', upstreamTrackingRef], { cwd: forkRepo.rootPath }).stdout.trim();
    expect(upstreamShaAfter).toBe(upstreamShaBefore);

    // refs/heads/master (local branch) must be untouched
    const localBranchShaAfter = realGit(['rev-parse', `refs/heads/${defaultBranchName}`], {
      cwd: forkRepo.rootPath,
    }).stdout.trim();
    expect(localBranchShaAfter).toBe(localBranchShaBefore);
  });

  it('respects depth option', () => {
    gitOverride = noOpSuccess;
    const res = gitFetch({ cwd: repo.rootPath, depth: 1, verbose: true, remote: '', branch: defaultBranchName });

    expect(gitSpy).toHaveBeenCalledWith(['fetch', '--depth=1'], expect.anything());
    expect(res).toMatchObject({ success: true });
    expect(logs.mocks.log).toHaveBeenCalledWith(`Fetching all remotes (with --depth=1)...`);
  });

  it('respects deepen option', () => {
    gitOverride = noOpSuccess;
    const res = gitFetch({ cwd: repo.rootPath, deepen: 1, verbose: true, remote: '', branch: defaultBranchName });

    expect(gitSpy).toHaveBeenCalledWith(['fetch', '--deepen=1'], expect.anything());
    expect(res).toMatchObject({ success: true });
    expect(logs.mocks.log).toHaveBeenCalledWith(`Fetching all remotes (with --deepen=1)...`);
  });

  it('respects unshallow option', () => {
    gitOverride = noOpSuccess;
    const res = gitFetch({ cwd: repo.rootPath, unshallow: true, verbose: true, remote: '', branch: defaultBranchName });

    expect(gitSpy).toHaveBeenCalledWith(['fetch', '--unshallow'], expect.anything());
    expect(res).toMatchObject({ success: true });
    expect(logs.mocks.log).toHaveBeenCalledWith(`Fetching all remotes (with --unshallow)...`);
  });
});
