import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { initMockLogs } from '@microsoft/beachball-test-utilities';
import type { GitProcessOutput } from 'workspace-tools';
import * as workspaceTools from 'workspace-tools';
import { defaultBranchName, defaultRemoteName } from '../../__fixtures__/gitDefaults';
import type { Repository } from '../../__fixtures__/repository';
import { RepositoryFactory } from '../../__fixtures__/repositoryFactory';
import { gitFetch } from '../../git/fetch';
import { clearGitAuthEnvCache } from '../../git/getGitAuthEnv';

// required for `jest.spyOn('workspace-tools', git)` to work
jest.mock('workspace-tools', () => {
  const original = jest.requireActual<typeof workspaceTools>('workspace-tools');
  return {
    ...original,
    git: jest.fn(original.git),
  };
});

const realGit = jest.requireActual<typeof workspaceTools>('workspace-tools').git;
const gitFailFast: typeof workspaceTools.gitFailFast = (args, options) =>
  workspaceTools.gitFailFast(args, { cwd: '', ...options, noExitCode: true });

/**
 * Set this to override the git implementation for one test.
 * (Use this instead of `.mockImplementation()` to avoid interference with other mocks.)
 */
let gitOverride: typeof realGit | undefined;
const gitSpy = (workspaceTools.git as jest.MockedFunction<typeof realGit>).mockImplementation((...args) =>
  (gitOverride || realGit)(...args)
);

describe('gitFetch', () => {
  const logs = initMockLogs();

  let repositoryFactory: RepositoryFactory;
  let repo: Repository;
  let realRemoteUrl = '';
  /** Set this to indicate that the default remote has been modified and needs to be restored */
  let modifiedRemote = false;

  // refs/heads/ on the source side is unambiguous: bare branch names can be silently
  // misresolved, causing git to treat the ref as absent and delete the local tracking ref.
  const refspec = (remote: string = defaultRemoteName, branch: string = defaultBranchName) =>
    `+refs/heads/${branch}:refs/remotes/${remote}/${branch}`;

  const fetchArgs = (remote: string = defaultRemoteName, branch: string = defaultBranchName) => [
    'fetch',
    '--no-tags',
    remote,
    refspec(remote, branch),
  ];

  const fetchExtraArgs = (extraArgs: string[] = []) => [
    'fetch',
    '--no-tags',
    ...extraArgs,
    defaultRemoteName,
    refspec(),
  ];

  const defaultLogPrefix = `Fetching branch "${defaultBranchName}" from remote "${defaultRemoteName}"`;
  const defaultVerbosePrefix = `${defaultLogPrefix} (${refspec()})`;

  /** To speed things up, some tests only check the arguments and skip the git operation */
  const noOpSuccess = () => ({ success: true, stdout: '', stderr: '', status: 0 }) as GitProcessOutput;

  /**
   * Default `gitFetch` options to spread into every call. Includes the omittable-but-required
   * `verbose`/`gitToken` fields (each defaulting to `undefined`) plus the default remote/branch;
   * individual tests override as needed and add their own `cwd`.
   */
  const commonOptions = {
    remote: defaultRemoteName,
    branch: defaultBranchName,
    verbose: undefined,
    gitToken: undefined,
  };
  /** The git args for a default fetch (no extra options). */
  const baseArgs = fetchArgs();

  beforeAll(() => {
    repositoryFactory = new RepositoryFactory('single');
    repo = repositoryFactory.cloneRepository();
    realRemoteUrl = repo.git(['remote', 'get-url', defaultRemoteName]).stdout.trim();
    gitSpy.mockClear();
  });

  afterEach(() => {
    gitOverride = undefined;
    clearGitAuthEnvCache();
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
    const mutexParams = { ...commonOptions, cwd: '' };
    // use 0 for all of the depth/deepen values to verify it's not using falsy checks
    expect(() => gitFetch({ ...mutexParams, depth: 0, deepen: 0 })).toThrow(err);
    expect(() => gitFetch({ ...mutexParams, depth: 0, unshallow: true })).toThrow(err);
    expect(() => gitFetch({ ...mutexParams, deepen: 0, unshallow: true })).toThrow(err);
    expect(() => gitFetch({ ...mutexParams, depth: 0, deepen: 0, unshallow: true })).toThrow(err);
    expect(gitSpy).not.toHaveBeenCalled();
  });

  it('fetches and does not log by default', () => {
    const res = gitFetch({ ...commonOptions, cwd: repo.rootPath });
    expect(gitSpy).toHaveBeenCalledWith(fetchArgs(), { cwd: repo.rootPath, stdio: 'pipe' });
    expect(res).toMatchObject({ success: true });
    expect(logs.mocks.log).not.toHaveBeenCalled();
  });

  it('does not pass an env to git when no gitToken is provided', () => {
    gitFetch({ ...commonOptions, cwd: repo.rootPath });
    expect(gitSpy).toHaveBeenCalledWith(baseArgs, { cwd: repo.rootPath, stdio: 'pipe' });
    expect(gitSpy.mock.calls[0][1]).not.toHaveProperty('env');
  });

  it('computes and merges the auth env over process.env when a gitToken is provided', () => {
    // Token auth requires an https remote (the real remote in these tests is a local path)
    const httpsRemote = 'https://github.com/microsoft/beachball';
    gitOverride = (args): GitProcessOutput =>
      args[0] === 'remote' && args[1] === 'get-url'
        ? ({ success: true, stdout: httpsRemote, stderr: '', status: 0 } as GitProcessOutput)
        : noOpSuccess();
    gitFetch({ ...commonOptions, cwd: repo.rootPath, gitToken: 'my-token' });

    const passedEnv = gitSpy.mock.calls.find(call => call[0][0] === 'fetch')?.[1]?.env;
    expect(passedEnv).toMatchObject({
      // Auth env keys are present, scoped to the actual remote URL...
      GIT_CONFIG_KEY_0: `http.${httpsRemote}.extraheader`,
      GIT_CONFIG_VALUE_0: '',
      GIT_TRACE: '0',
      // ...and process.env is preserved (spawnSync replaces the whole env otherwise)
      PATH: process.env.PATH,
    });
    // The raw token is never placed on git's argv
    expect(gitSpy.mock.calls.map(call => call[0].join(' ')).join(' ')).not.toContain('my-token');
  });

  it('returns error but does not throw or log on failure by default', () => {
    // This test uses controlled non-localized fake stdio so we can test the whole output
    gitOverride = () => ({ success: false, stdout: 'some logs', stderr: 'oh no', status: 1 }) as GitProcessOutput;

    const res = gitFetch({ ...commonOptions, cwd: repo.rootPath });
    expect(res).toMatchObject({
      success: false,
      errorMessage: [`${defaultLogPrefix} failed (code 1)`, 'stdout:', 'some logs', 'stderr:', 'oh no'].join('\n'),
      status: 1,
      stderr: 'oh no',
      stdout: 'some logs',
    });
    expect(logs.mocks.log).not.toHaveBeenCalled();
  });

  it('returns error but does not throw if remote is invalid', () => {
    repo.git(['remote', 'set-url', defaultRemoteName, 'invalid-url']);
    modifiedRemote = true;

    const res = gitFetch({ ...commonOptions, cwd: repo.rootPath });
    expect(res).toMatchObject({
      success: false,
      errorMessage: expect.stringContaining(`${defaultLogPrefix} failed (code 128)`),
      // The URL is the only part of the error message that isn't localized
      stderr: expect.stringContaining('invalid-url'),
    });
    expect(res.errorMessage).toContain('invalid-url');
  });

  it('logs git output if verbose is true', () => {
    // use predictable output
    gitOverride = () => ({ ...noOpSuccess(), stdout: 'some logs', stderr: 'some debug' });

    const res = gitFetch({ ...commonOptions, cwd: repo.rootPath, verbose: true });
    // normally this would be called with stdio: inherit, but it's not done that way in tests
    // because process.stdout/stderr can't be mocked, so the test output would be too spammy
    expect(gitSpy).toHaveBeenCalledWith(fetchArgs(), expect.anything());
    expect(res).toMatchObject({ success: true });
    expect(res.errorMessage).toBeUndefined();
    expect(logs.mocks.log).toHaveBeenCalledWith(
      // show this complete literal log
      'Fetching branch "master" from remote "origin" (+refs/heads/master:refs/remotes/origin/master)...'
    );
    expect(logs.mocks.log).toHaveBeenCalledWith('some logs');
    expect(logs.mocks.log).toHaveBeenCalledWith('some debug');
    expect(logs.mocks.log).toHaveBeenCalledWith(`${defaultLogPrefix} completed successfully`);
  });

  it('logs git output with failed fetch if verbose is true', () => {
    gitOverride = () => ({ success: false, stdout: 'some logs', stderr: 'oh no', status: 1 }) as GitProcessOutput;

    const res = gitFetch({ ...commonOptions, cwd: repo.rootPath, verbose: true });
    expect(gitSpy).toHaveBeenCalledWith(fetchArgs(), expect.anything());
    expect(res).toMatchObject({
      success: false,
      errorMessage: `${defaultLogPrefix} failed (code 1) - see above for details`,
      status: 1,
    });
    expect(logs.mocks.log).toHaveBeenCalledWith(`${defaultVerbosePrefix}...`);
    expect(logs.mocks.log).toHaveBeenCalledWith('some logs');
    expect(logs.mocks.warn).toHaveBeenCalledWith('oh no');
    expect(logs.mocks.warn).toHaveBeenCalledWith(`${defaultLogPrefix} failed (code 1)`);
  });

  it('fetches multiple branches in a single invocation', () => {
    // Multiple refspecs let one --deepen / --unshallow cover both refs in a single network
    // round-trip — used by ensureSharedHistory when it has to deepen both HEAD and the target.
    gitOverride = noOpSuccess;
    const otherBranch = 'feature';
    const res = gitFetch({
      ...commonOptions,
      cwd: repo.rootPath,
      branch: [defaultBranchName, otherBranch],
      verbose: true,
    });
    expect(res).toMatchObject({ success: true });

    const refspec2 = refspec(defaultRemoteName, otherBranch);
    expect(gitSpy).toHaveBeenCalledWith([...fetchArgs(), refspec2], expect.anything());
    expect(logs.mocks.log).toHaveBeenCalledWith(
      `Fetching branches "${defaultBranchName}", "${otherBranch}" from remote "${defaultRemoteName}" ` +
        `(${refspec()} ${refspec2})...`
    );
    expect(logs.mocks.log).toHaveBeenCalledWith(
      `Fetching branches "${defaultBranchName}", "${otherBranch}" from remote "${defaultRemoteName}" completed successfully`
    );
  });

  it('includes additional refspecs', () => {
    gitOverride = noOpSuccess;
    const additionalRefspec = '0123456789abcdef';
    const res = gitFetch({
      ...commonOptions,
      cwd: repo.rootPath,
      additionalRefspecs: [additionalRefspec],
      verbose: true,
    });
    expect(res).toMatchObject({ success: true });

    expect(gitSpy).toHaveBeenCalledWith([...fetchArgs(), additionalRefspec], expect.anything());
    expect(logs.mocks.log).toHaveBeenCalledWith(`${defaultLogPrefix} (${refspec()} ${additionalRefspec})...`);
  });

  it('preserves the tracking ref after a real fetch', () => {
    // With a bare branch name like 'master' as the refspec source, git can fail to resolve it
    // on the remote and treat it as absent, pruning refs/remotes/origin/master (exit code 0).
    // Using refs/heads/ avoids this. This test runs a real fetch to catch any regression.
    const res = gitFetch({ ...commonOptions, cwd: repo.rootPath });
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
    const upstreamShaBefore = forkRepo.git(['rev-parse', upstreamTrackingRef]).stdout.trim();
    const localBranchShaBefore = forkRepo.git(['rev-parse', `refs/heads/${defaultBranchName}`]).stdout.trim();
    expect(upstreamShaBefore).toBeTruthy();

    gitSpy.mockClear();
    const res = gitFetch({ ...commonOptions, cwd: forkRepo.rootPath });
    expect(res).toMatchObject({ success: true });

    // The fetch command must target only origin with the correct refspec
    expect(gitSpy).toHaveBeenCalledWith(fetchArgs(), expect.anything());

    // origin/master must exist and be reachable
    gitFailFast(['rev-parse', '--verify', `refs/remotes/${defaultRemoteName}/${defaultBranchName}`], {
      cwd: forkRepo.rootPath,
    });
    gitFailFast(['merge-base', `${defaultRemoteName}/${defaultBranchName}`, 'HEAD'], { cwd: forkRepo.rootPath });

    // upstream/master must be completely unaffected
    const upstreamShaAfter = forkRepo.git(['rev-parse', upstreamTrackingRef]).stdout.trim();
    expect(upstreamShaAfter).toBe(upstreamShaBefore);

    // refs/heads/master (local branch) must be untouched
    const localBranchShaAfter = forkRepo.git(['rev-parse', `refs/heads/${defaultBranchName}`]).stdout.trim();
    expect(localBranchShaAfter).toBe(localBranchShaBefore);
  });

  it('respects depth option', () => {
    gitOverride = noOpSuccess;
    const res = gitFetch({
      ...commonOptions,
      cwd: repo.rootPath,
      depth: 1,
      verbose: true,
    });

    expect(gitSpy).toHaveBeenCalledWith(fetchExtraArgs(['--depth=1']), expect.anything());
    expect(res).toMatchObject({ success: true });
    expect(logs.mocks.log).toHaveBeenCalledWith(`${defaultVerbosePrefix} (with --depth=1)...`);
  });

  it('respects deepen option', () => {
    gitOverride = noOpSuccess;
    const res = gitFetch({
      ...commonOptions,
      cwd: repo.rootPath,
      deepen: 1,
      verbose: true,
    });

    expect(gitSpy).toHaveBeenCalledWith(fetchExtraArgs(['--deepen=1']), expect.anything());
    expect(res).toMatchObject({ success: true });
    expect(logs.mocks.log).toHaveBeenCalledWith(`${defaultVerbosePrefix} (with --deepen=1)...`);
  });

  it('respects unshallow option', () => {
    gitOverride = noOpSuccess;
    const res = gitFetch({
      ...commonOptions,
      cwd: repo.rootPath,
      unshallow: true,
      verbose: true,
    });

    expect(gitSpy).toHaveBeenCalledWith(fetchExtraArgs(['--unshallow']), expect.anything());
    expect(res).toMatchObject({ success: true });
    expect(logs.mocks.log).toHaveBeenCalledWith(`${defaultVerbosePrefix} (with --unshallow)...`);
  });
});
