import { describe, expect, it, jest, afterEach } from '@jest/globals';
import * as workspaceTools from 'workspace-tools';
import type { GitProcessOutput } from 'workspace-tools';
import {
  getGitAuthEnv,
  clearGitAuthEnvCache,
  getAuthHeaderValue,
  getTokenFromAuthHeader,
  type GitAuthEnvParams,
} from '../../git/getGitAuthEnv';
import { BeachballError } from '../../types/BeachballError';

jest.mock('workspace-tools');

const mockGit = workspaceTools.git as jest.MockedFunction<typeof workspaceTools.git>;

function gitResult(opts: { success: boolean; stdout?: string }): GitProcessOutput {
  return {
    success: opts.success,
    stdout: opts.stdout ?? '',
    stderr: '',
    status: opts.success ? 0 : 1,
  } as GitProcessOutput;
}

/**
 * Mock `git remote get-url` (returning `url`, or a failure if `url` is empty) and
 * `git config --get-regexp` (returning the given `key value` extraheader entries).
 */
function setupGitMock(params: { remoteUrl: string; configEntries?: string[] }): void {
  const { remoteUrl, configEntries = [] } = params;
  mockGit.mockImplementation((args: string[]) => {
    return args[0] === 'remote' && args[1] === 'get-url'
      ? gitResult({ success: !!remoteUrl, stdout: remoteUrl })
      : args[0] === 'config'
        ? gitResult({ success: configEntries.length > 0, stdout: configEntries.join('\n') })
        : gitResult({ success: false });
  });
}

/** Collect the ordered `{ key, value }` GIT_CONFIG entries from the returned env. */
function getConfigEntries(env: NodeJS.ProcessEnv): { key: string; value: string }[] {
  const count = Number(env.GIT_CONFIG_COUNT);
  return Array.from({ length: count }, (_, i) => ({
    key: env[`GIT_CONFIG_KEY_${i}`]!,
    value: env[`GIT_CONFIG_VALUE_${i}`]!,
  }));
}

describe('getGitAuthEnv', () => {
  const cwd = '/fake/repo';
  const remoteUrl = 'https://github.com/org/repo.git';
  /** The header is scoped to the exact remote URL that git will connect to. */
  const remoteKey = `http.${remoteUrl}.extraheader`;
  const gitToken = 'my-token';
  const gitTokenHeader = getAuthHeaderValue(gitToken);
  const common: GitAuthEnvParams = {
    path: cwd,
    remote: 'origin',
    gitToken,
    env: { FAKE: 'value' },
    operation: 'fetch',
  };

  afterEach(() => {
    jest.clearAllMocks();
    clearGitAuthEnvCache();
  });

  it('returns undefined (and reads no config) when no token is provided', () => {
    expect(getGitAuthEnv({ ...common, gitToken: undefined })).toBeUndefined();
    expect(getGitAuthEnv({ ...common, gitToken: '' })).toBeUndefined();
    expect(mockGit).not.toHaveBeenCalled();
  });

  it('throws if a token is provided but the remote URL cannot be resolved', () => {
    setupGitMock({ remoteUrl: '' }); // remote get-url fails
    expect(() => getGitAuthEnv(common)).toThrow(BeachballError);
    expect(() => getGitAuthEnv({ ...common, remote: '' })).toThrow(BeachballError);
  });

  it('throws for a remote that is not HTTPS or localhost', () => {
    // http.extraheader only affects http(s) transports, and a token must never be sent in plaintext to a
    // real server, so SSH and non-localhost/loopback http remotes are rejected.
    setupGitMock({ remoteUrl: 'git@github.com:org/repo.git' });
    expect(() => getGitAuthEnv({ ...common, remote: 'origin1' })).toThrow('non-HTTPS URL "git@');
    setupGitMock({ remoteUrl: 'ssh://git@github.com/org/repo.git' });
    expect(() => getGitAuthEnv({ ...common, remote: 'origin2' })).toThrow('non-HTTPS URL "ssh:');
    setupGitMock({ remoteUrl: 'http://github.com/repo' });
    expect(() => getGitAuthEnv({ ...common, remote: 'origin3' })).toThrow('non-HTTPS URL "http:');
  });

  it('allows a loopback http remote (for local testing)', () => {
    setupGitMock({ remoteUrl: 'http://127.0.0.1:5000/repo.git' });
    const result = getGitAuthEnv({ ...common })!;
    expect(result.GIT_CONFIG_KEY_0).toBe('http.http://127.0.0.1:5000/repo.git.extraheader');
  });

  it('resolves the remote URL and reads existing extraheaders via --get-regexp', () => {
    setupGitMock({ remoteUrl });
    getGitAuthEnv({ ...common });

    expect(mockGit).toHaveBeenCalledWith(['remote', 'get-url', common.remote], { cwd });
    expect(mockGit).toHaveBeenCalledWith(['config', '--get-regexp', '.*\\.extraheader'], { cwd });
  });

  it('resolves the push URL (which may differ from the fetch URL) for the push path', () => {
    setupGitMock({ remoteUrl });
    getGitAuthEnv({ ...common, operation: 'push' });

    // `get-url --push` returns remote.<name>.pushurl when set, so the header is scoped correctly for push
    expect(mockGit).toHaveBeenCalledWith(['remote', 'get-url', '--push', common.remote], { cwd });
  });

  it('scopes the header to the remote URL and adds Basic auth when there is no existing config', () => {
    setupGitMock({ remoteUrl });
    const result = getGitAuthEnv({ ...common })!;

    const entries = getConfigEntries(result);
    // Every entry targets the remote URL key; first an empty reset, then our auth header
    expect(entries).toEqual([
      { key: remoteKey, value: '' },
      { key: remoteKey, value: gitTokenHeader },
    ]);
    // HTTP Basic auth with username x-access-token
    expect(getTokenFromAuthHeader(entries[1].value)).toBe(gitToken);
  });

  it('drops an existing auth header that applies to the remote (e.g. from a CI checkout)', () => {
    setupGitMock({ remoteUrl, configEntries: [`${remoteKey} Authorization: basic STALE-CI-TOKEN`] });
    const result = getGitAuthEnv({ ...common })!;

    const entries = getConfigEntries(result);
    // Just the reset + our header; the stale auth header is not re-added
    expect(entries).toEqual([
      { key: remoteKey, value: '' },
      { key: remoteKey, value: gitTokenHeader },
    ]);
    // The stale token is never propagated
    expect(JSON.stringify(result)).not.toContain('STALE-CI-TOKEN');
  });

  it('preserves an existing non-auth base header (applies to all URLs)', () => {
    setupGitMock({
      remoteUrl,
      configEntries: [
        'http.extraheader X-Proxy: corp-proxy', // base header (applies to all URLs, incl. the remote)
        `http.https://github.com/.extraheader Authorization: basic STALE`, // host auth, should be dropped
      ],
    });
    const result = getGitAuthEnv({ ...common })!;

    const entries = getConfigEntries(result);
    expect(entries).toEqual([
      { key: remoteKey, value: '' },
      // Preserved non-auth headers are re-added under the remote URL key so they survive the reset
      { key: remoteKey, value: 'X-Proxy: corp-proxy' },
      { key: remoteKey, value: gitTokenHeader },
    ]);
    expect(getTokenFromAuthHeader(entries[2].value)).toBe(gitToken);
  });

  it('preserves a non-auth header scoped to the remote host', () => {
    setupGitMock({ remoteUrl, configEntries: ['http.https://github.com/.extraheader X-GitHub-Trace: abc'] });
    const result = getGitAuthEnv({ ...common })!;

    const entries = getConfigEntries(result);
    expect(entries).toEqual([
      { key: remoteKey, value: '' },
      // Preserved non-auth headers are re-added under the remote URL key so they survive the reset
      { key: remoteKey, value: 'X-GitHub-Trace: abc' },
      { key: remoteKey, value: gitTokenHeader },
    ]);
    expect(getTokenFromAuthHeader(entries[2].value)).toBe(gitToken);
  });

  it('ignores extraheaders scoped to other hosts (auth or not)', () => {
    setupGitMock({
      remoteUrl,
      configEntries: [
        'http.https://dev.azure.com/.extraheader Authorization: bearer AZURE-TOKEN',
        'http.https://example.com/.extraheader X-Custom: value',
      ],
    });
    const result = getGitAuthEnv({ ...common })!;

    const entries = getConfigEntries(result);
    // Neither the azure token nor the example.com header is included (not sent to the remote anyway)
    expect(entries).toEqual([
      { key: remoteKey, value: '' },
      { key: remoteKey, value: gitTokenHeader },
    ]);
    expect(getTokenFromAuthHeader(entries[1].value)).toBe(gitToken);
    expect(JSON.stringify(result)).not.toContain('AZURE-TOKEN');
    expect(JSON.stringify(result)).not.toContain('X-Custom');
  });

  it('ignores a same-host header scoped to a different repo path', () => {
    setupGitMock({ remoteUrl, configEntries: ['http.https://github.com/other/repo.git.extraheader X-Other: value'] });
    const result = getGitAuthEnv({ ...common })!;

    const entries = getConfigEntries(result);
    // The header is scoped to a different repo path, so it isn't sent to our remote
    expect(entries).toHaveLength(2);
    expect(JSON.stringify(result)).not.toContain('X-Other');
  });

  it('ignores a header scoped to a different username on the same host', () => {
    // Git only applies a user-scoped config URL to targets with the same user; our remote URL has no
    // user, so this header would not be sent to it and must not be re-added under the remote key.
    setupGitMock({ remoteUrl, configEntries: ['http.https://user@github.com/.extraheader X-User: value'] });
    const result = getGitAuthEnv({ ...common })!;

    const entries = getConfigEntries(result);
    expect(entries).toHaveLength(2);
    expect(JSON.stringify(result)).not.toContain('X-User');
  });

  it('parses values containing spaces and treats auth detection case-insensitively', () => {
    setupGitMock({
      remoteUrl,
      configEntries: [
        'http.extraheader X-Note: has multiple spaces',
        `${remoteKey} authorization: basic lowercase-stale`,
      ],
    });
    const result = getGitAuthEnv({ ...common })!;

    expect(getConfigEntries(result)).toEqual([
      { key: remoteKey, value: '' },
      // Preserved non-auth headers are re-added under the remote URL key so they survive the reset
      { key: remoteKey, value: 'X-Note: has multiple spaces' },
      { key: remoteKey, value: gitTokenHeader },
    ]);
    // lowercase "authorization" was still detected as auth and dropped
    expect(JSON.stringify(result)).not.toContain('lowercase-stale');
  });

  it('ignores blank lines when parsing existing extraheaders', () => {
    mockGit.mockImplementation((args: string[]) => {
      if (args[0] === 'remote') return gitResult({ success: true, stdout: remoteUrl });
      return gitResult({ success: true, stdout: 'http.extraheader X-A: 1\n\n  \n' });
    });

    const result = getGitAuthEnv({ ...common })!;
    expect(getConfigEntries(result)).toEqual([
      { key: remoteKey, value: '' },
      // Preserved non-auth headers are re-added under the remote URL key so they survive the reset
      { key: remoteKey, value: 'X-A: 1' },
      { key: remoteKey, value: gitTokenHeader },
    ]);
  });

  it('disables git trace/curl-verbose env vars so the auth header cannot leak via tracing', () => {
    setupGitMock({ remoteUrl });
    const result = getGitAuthEnv({ ...common })!;
    expect(result).toMatchObject({
      GIT_TRACE: '0',
      GIT_CURL_VERBOSE: '0',
      GIT_TRACE_CURL: '0',
    });
  });

  it('appends after any pre-existing GIT_CONFIG_* entries in the env', () => {
    setupGitMock({ remoteUrl });
    const env = { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'user.name', GIT_CONFIG_VALUE_0: 'Someone' };
    const result = getGitAuthEnv({ ...common, env })!;

    // The pre-existing entry is preserved, and ours are appended starting at index 1
    expect(result.GIT_CONFIG_COUNT).toBe('3');
    expect(result.GIT_CONFIG_KEY_0).toBe('user.name');
    expect(result.GIT_CONFIG_VALUE_0).toBe('Someone');
    expect(getConfigEntries(result).slice(1)).toEqual([
      { key: remoteKey, value: '' },
      { key: remoteKey, value: gitTokenHeader },
    ]);
  });

  it('caches the result per cwd + remote + token (reads git only once)', () => {
    setupGitMock({ remoteUrl });
    const first = getGitAuthEnv({ ...common });
    const second = getGitAuthEnv({ ...common });

    // Equal result returned, and git was only invoked once (get-url + config); the env is rebuilt
    // each call (only the git-derived config values are cached), so it's an equal—not same—object.
    expect(second).toEqual(first);
    expect(mockGit).toHaveBeenCalledTimes(2);
  });

  it('recomputes for a different cwd, remote, or token', () => {
    setupGitMock({ remoteUrl });
    getGitAuthEnv({ ...common });
    getGitAuthEnv({ ...common, gitToken: 'other-token' });
    getGitAuthEnv({ ...common, remote: 'upstream' });
    getGitAuthEnv({ ...common, path: '/other/repo' });

    // 4 distinct cache keys, each reading git twice (get-url + config)
    expect(mockGit).toHaveBeenCalledTimes(8);
  });
});
