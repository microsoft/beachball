/* eslint-disable etc/no-deprecated -- lots of incorrect warnings about variadic signatures */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import path from 'path';
import * as wsTools from 'workspace-tools';
import type { GitProcessOutput } from 'workspace-tools';
import _execa from 'execa';
import { bumpAndPush } from '../../publish/bumpAndPush';
import { performBump as _performBump } from '../../bump/performBump';
import { tagPackages as _tagPackages } from '../../publish/tagPackages';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { makePackageInfos } from '../../__fixtures__/packageInfos';
import type { BumpInfo } from '../../types/BumpInfo';
import { defaultRemoteBranchName } from '../../__fixtures__/gitDefaults';
import { getParsedOptions } from '../../options/getOptions';
import { BeachballError } from '../../types/BeachballError';
import type { BeachballOptions } from '../../types/BeachballOptions';

jest.mock('execa');
jest.mock('workspace-tools');
jest.mock('../../bump/performBump'); // this has a bunch of logic which is tested separately
jest.mock('../../publish/tagPackages');

// execa's overloaded types are too complex for jest.Mock, so we cast it to the signature that's used
const mockExeca = _execa as unknown as jest.MockedFunction<
  (file: string, args?: readonly string[], options?: _execa.Options) => _execa.ExecaChildProcess
>;
const mockPerformBump = _performBump as jest.MockedFunction<typeof _performBump>;
const mockTagPackages = _tagPackages as jest.MockedFunction<typeof _tagPackages>;
const wsToolsMocks = wsTools as jest.Mocked<typeof wsTools>;

describe('bumpAndPush', () => {
  const logs = initMockLogs();

  const fakeRoot = path.resolve('/fake/root');
  const publishBranch = 'publish_12345';

  /** Create a mock execa result that resolves like a real ExecaChildProcess */
  function makeExecaResult(opts: { success: boolean; output?: string; timedOut?: boolean }) {
    const result = {
      failed: !opts.success,
      all: opts.output ?? '',
      exitCode: opts.success ? 0 : 1,
      stdout: opts.output ?? '',
      stderr: '',
      timedOut: opts.timedOut ?? false,
    } as _execa.ExecaReturnValue;
    return Object.assign(Promise.resolve(result), { stdout: null, stderr: null }) as _execa.ExecaChildProcess;
  }

  function getExecaCalls() {
    return mockExeca.mock.calls.map(([file, args]) => `${file} ${args?.join(' ')}`);
  }

  function getWsToolsGitCalls() {
    return wsToolsMocks.git.mock.calls.map(([args]) => `git ${args.join(' ')}`);
  }

  /** Create a mock workspace-tools git() result */
  function makeGitResult(opts: { success: boolean; output?: string }): GitProcessOutput {
    return {
      stderr: opts.success ? '' : opts.output ?? '',
      stdout: opts.success ? opts.output ?? '' : '',
      success: opts.success,
      status: opts.success ? 0 : 1,
    } as GitProcessOutput;
  }

  function callBumpAndPush(optionOverrides?: Partial<BeachballOptions>, maxRetries?: number) {
    const { options } = getParsedOptions({
      cwd: fakeRoot,
      argv: [],
      env: {},
      testRepoOptions: {
        branch: defaultRemoteBranchName,
        message: 'apply package updates',
        ...optionOverrides,
      },
    });
    const bumpInfo: BumpInfo = {
      packageInfos: makePackageInfos({ foo: { version: '1.1.0' }, bar: { version: '2.0.0' } }),
      modifiedPackages: new Set(['foo', 'bar']),
      changeFileChangeInfos: [],
      calculatedChangeTypes: { foo: 'minor', bar: 'major' },
      dependentChangedBy: {},
      packageGroups: {},
      scopedPackages: new Set(['foo', 'bar']),
    };
    return bumpAndPush(bumpInfo, publishBranch, options, maxRetries);
  }

  beforeEach(() => {
    wsToolsMocks.parseRemoteBranch.mockReturnValue({ remote: 'origin', remoteBranch: 'master' });
    wsToolsMocks.revertLocalChanges.mockReturnValue(true);
    wsToolsMocks.git.mockReturnValue(makeGitResult({ success: true }));
    mockExeca.mockImplementation(() => makeExecaResult({ success: true }));
    mockPerformBump.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('succeeds on first attempt', async () => {
    await callBumpAndPush();

    expect(mockPerformBump).toHaveBeenCalledTimes(1);
    expect(mockTagPackages).toHaveBeenCalledTimes(1);
    expect(wsToolsMocks.revertLocalChanges).toHaveBeenCalledTimes(1);
    expect(getWsToolsGitCalls().join('\n')).toEqual('git fetch origin +refs/heads/master:refs/remotes/origin/master');
    expect(getExecaCalls()).toEqual([
      'git merge -X theirs origin/master',
      'git add .',
      'git commit -m apply package updates',
      'git checkout origin/master',
      'git merge -X ours publish_12345',
      'git push --no-verify --follow-tags --verbose origin HEAD:master',
    ]);

    // Beachball's logs are its UI, so snapshots are essentially "visual regression" tests
    expect(logs.getMockLines('all')).toMatchSnapshot();
  });

  it('skips fetch when options.fetch is false', async () => {
    await callBumpAndPush({ fetch: false });

    expect(wsToolsMocks.git).not.toHaveBeenCalled();
    expect(getExecaCalls().join('\n')).not.toContain('fetch');
  });

  it('specifies fetch depth when depth param is defined', async () => {
    wsToolsMocks.git.mockImplementation((args: string[]) => {
      if (args[0] === 'fetch') {
        expect(args).toContain('--depth=10');
      }
      return { stdout: '', stderr: '', success: true } as wsTools.GitProcessOutput;
    });

    expect.assertions(1);
    await callBumpAndPush({ fetch: true, depth: 10 });
  });

  it('retries on fetch failure then succeeds', async () => {
    wsToolsMocks.git
      .mockReturnValueOnce(makeGitResult({ success: false, output: 'fetch error' }))
      .mockReturnValueOnce(makeGitResult({ success: true }));

    await callBumpAndPush();

    expect(wsToolsMocks.revertLocalChanges).toHaveBeenCalledTimes(2);
    expect(mockPerformBump).toHaveBeenCalledTimes(1);

    expect(logs.getMockLines('warn')).toMatchInlineSnapshot(`
      "fetch error
      Fetching branch "master" from remote "origin" failed (code 1)
      [WARN 1/5]: Fetching from origin/master has failed! (see above for details)"
    `);
    expect(logs.getMockLines('all')).toMatchSnapshot();
  });

  it('retries on mergePublishBranch failure then succeeds', async () => {
    // First attempt: merge with branch succeeds, but commit in mergePublishBranch fails
    // (merge is call 1, add is call 2, commit is call 3)
    let callCount = 0;
    mockExeca.mockImplementation(() => {
      callCount++;
      // Fail on 3rd call (commit) in first attempt
      if (callCount === 3) {
        return makeExecaResult({ success: false, output: 'commit failed' });
      }
      return makeExecaResult({ success: true });
    });

    await callBumpAndPush();

    expect(wsToolsMocks.revertLocalChanges).toHaveBeenCalledTimes(2);
    expect(mockPerformBump).toHaveBeenCalledTimes(2);

    expect(logs.getMockLines('warn')).toMatchInlineSnapshot(`
      "commit failed
      git commit -m apply package updates failed (code 1)
      [WARN 1/5]: Merging to target has failed! (see above for details)"
    `);
  });

  it('retries on push failure then succeeds', async () => {
    let pushCount = 0;
    mockExeca.mockImplementation((_cmd, args) => {
      if (args?.[0] === 'push') {
        pushCount++;
        if (pushCount === 1) return makeExecaResult({ success: false, output: 'push rejected' });
      }
      return makeExecaResult({ success: true });
    });

    await callBumpAndPush();

    expect(wsToolsMocks.revertLocalChanges).toHaveBeenCalledTimes(2);
    expect(mockPerformBump).toHaveBeenCalledTimes(2);
    expect(mockTagPackages).toHaveBeenCalledTimes(2);

    expect(logs.getMockLines('warn')).toMatchInlineSnapshot(`
      "push rejected
      git push --no-verify --follow-tags --verbose origin HEAD:master failed (code 1)
      [WARN 1/5]: Pushing to origin/master has failed! (see above for details)"
    `);
  });

  it('shows timeout message on push timeout', async () => {
    let pushCount = 0;
    mockExeca.mockImplementation((_cmd, args) => {
      if (args?.[0] === 'push') {
        pushCount++;
        if (pushCount === 1) return makeExecaResult({ success: false, timedOut: true });
      }
      return makeExecaResult({ success: true });
    });

    await callBumpAndPush();

    expect(logs.getMockLines('warn')).toMatchInlineSnapshot(`
      "git push --no-verify --follow-tags --verbose origin HEAD:master failed (code 1)
      [WARN 1/5]: Pushing to origin/master has timed out! (see above for details)"
    `);
  });

  it('calls precommit hook before merge steps', async () => {
    // eslint-disable-next-line @typescript-eslint/require-await
    const precommit = jest.fn<(cwd: string) => Promise<void>>(async () => console.log('hello from hook'));
    await callBumpAndPush({ hooks: { precommit } });

    expect(precommit).toHaveBeenCalledTimes(1);
    expect(precommit).toHaveBeenCalledWith(fakeRoot);

    // Should be called right before series of merge steps
    expect(logs.getMockLines('log')).toContain('hello from hook\n\nMerging publish_');
  });

  it('calls precommit hook on each retry', async () => {
    const precommit = jest.fn<(cwd: string) => Promise<void>>();
    mockExeca.mockImplementation((_cmd, args) =>
      args?.[0] === 'push' ? makeExecaResult({ success: false, output: 'oh no' }) : makeExecaResult({ success: true })
    );

    await expect(() => callBumpAndPush({ hooks: { precommit } }, 3)).rejects.toThrow(BeachballError);

    expect(precommit).toHaveBeenCalledTimes(3);
  });

  it('throws and calls displayManualRecovery after all retries exhausted', async () => {
    // Fail every fetch (happens to give the shortest snapshot output)
    wsToolsMocks.git.mockReturnValue(makeGitResult({ success: false, output: 'network error' }));

    await expect(() => callBumpAndPush({}, 3)).rejects.toThrow('Failed to bump and push after 3 attempts');

    expect(wsToolsMocks.revertLocalChanges).toHaveBeenCalledTimes(3);
    expect(mockPerformBump).not.toHaveBeenCalled();

    const logOutput = logs.getMockLines('all');
    expect(logOutput).toContain('Something went wrong with publishing'); // from displayManualRecovery
    expect(logOutput).toMatchSnapshot();
  });
});
