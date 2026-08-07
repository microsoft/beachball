import { afterAll, afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import { initMockLogs } from '@microsoft/beachball-test-utilities';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { defaultBranchName } from '../../__fixtures__/gitDefaults';
import { RepositoryFactory } from '../../__fixtures__/repositoryFactory';
import { clearGitAuthEnvCache, getGitAuthEnv, getTokenFromAuthHeader } from '../../git/getGitAuthEnv';
import { gitAsync } from '../../git/gitAsync';

// This exercises the *push* path against a real (minimal) HTTP git remote to verify that git
// actually puts the intended `Authorization` header on the wire and preserves non-auth headers.
// (Unit/functional tests elsewhere only assert the `GIT_CONFIG_*` env vars beachball sets; this
// proves git honors them.)
//
// Push is used rather than fetch because `gitFetch` runs git via `spawnSync`, which blocks the
// Node event loop, so an in-process capture server could never respond mid-fetch. Push uses the
// async `gitAsync`, so the server below can capture the request while the push is in flight.
// Auth on push is also the more important case (it's what gates writing to the remote).

describe('getGitAuthEnv on push (real server)', () => {
  initMockLogs();

  let repositoryFactory: RepositoryFactory;

  // A capture-only server standing in for a git remote: it records the headers of each request
  // and returns 401 (without `WWW-Authenticate`, so git fails fast instead of prompting) since we
  // only care about what git sent, not completing the push.
  let server: http.Server;
  let remoteUrl = '';
  /** Raw header arrays (alternating name/value, preserving duplicates) for each received request. */
  let capturedRequests: string[][] = [];

  beforeAll(async () => {
    repositoryFactory = new RepositoryFactory('single');

    server = http.createServer((req, res) => {
      capturedRequests.push(req.rawHeaders);
      // Close the connection so no keep-alive socket lingers past the test.
      res.writeHead(401, { Connection: 'close' }).end();
    });
    await new Promise<void>((resolve, reject) => {
      // Surface a bind failure immediately instead of hanging until the Jest timeout.
      server.once('error', reject);
      // Port 0 lets the OS pick a free ephemeral port, so this can't conflict with other listeners.
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const { port } = server.address() as AddressInfo;
    remoteUrl = `http://127.0.0.1:${port}/repo.git`;
  });

  afterEach(() => {
    capturedRequests = [];
    clearGitAuthEnvCache();
  });

  afterAll(() => {
    repositoryFactory.cleanUp();
    server.closeAllConnections();
    server.close();
  });

  /** Parse the raw headers of the first captured request into `{ name (lowercased), value }` pairs. */
  function firstRequestHeaders(): { name: string; value: string }[] {
    const raw = capturedRequests[0] || [];
    const pairs: { name: string; value: string }[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      pairs.push({ name: raw[i].toLowerCase(), value: raw[i + 1] });
    }
    return pairs;
  }

  it('sends only the injected auth header and preserves non-auth extraheaders', async () => {
    const repo = repositoryFactory.cloneRepository();
    // Point the remote at the capture server so getGitAuthEnv scopes the header to this URL and
    // the push actually connects to it.
    repo.git(['remote', 'set-url', 'origin', remoteUrl]);

    const remoteKey = `http.${remoteUrl}.extraheader`;
    // Simulate a CI checkout step that injected a stale auth header (which must be dropped) plus a
    // non-auth header (which must be preserved), both under the remote URL key.
    const staleAuth = `AUTHORIZATION: basic ${Buffer.from('x-access-token:stale-token').toString('base64')}`;
    repo.git(['config', '--add', remoteKey, staleAuth]);
    repo.git(['config', '--add', remoteKey, 'X-Beachball-Test: keepme']);

    const gitToken = 'my-token';
    const authEnv = getGitAuthEnv({ gitToken, path: repo.rootPath, remote: 'origin', env: {}, operation: 'push' });

    const result = await gitAsync(
      [
        // Disable credential helpers (empty value resets the list) and interactive prompts so the
        // 401 fails immediately instead of invoking the OS credential manager (which pops up a UI).
        '-c',
        'credential.helper=',
        '-c',
        'credential.interactive=false',
        'push',
        '--no-verify',
        '--follow-tags',
        '--verbose',
        'origin',
        `HEAD:refs/heads/${defaultBranchName}`,
      ],
      {
        cwd: repo.rootPath,
        // Also block terminal/GUI credential prompts via env, in case a helper is still reached.
        env: { ...authEnv, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' },
        verbose: false,
        timeout: 3000,
      }
    );

    // The push fails (the server always returns 401), but we only care about the headers git sent.
    expect(result.success).toBe(false);
    expect(capturedRequests.length).toBeGreaterThan(0);

    const headers = firstRequestHeaders();

    // Exactly one Authorization header (the stale one was dropped), carrying our token. The reset
    // also proves git honored the empty-value reset that wipes the file-provided accumulation.
    const authHeaders = headers.filter(h => h.name === 'authorization');
    expect(authHeaders).toHaveLength(1);
    expect(getTokenFromAuthHeader(`Authorization: ${authHeaders[0].value}`)).toBe(gitToken);

    // The non-auth header is preserved (exactly once, re-added under the remote URL key).
    expect(headers.filter(h => h.name === 'x-beachball-test')).toEqual([{ name: 'x-beachball-test', value: 'keepme' }]);

    // Neither the real token nor the stale token appears in plaintext on the wire.
    const wire = JSON.stringify(capturedRequests);
    expect(wire).not.toContain(gitToken);
    expect(wire).not.toContain('stale-token');
  });

  it('does not leak a stale auth header scoped to a mismatched repo path (no .git)', async () => {
    const repo = repositoryFactory.cloneRepository();
    repo.git(['remote', 'set-url', 'origin', remoteUrl]);

    // The remote URL ends in `.git`, but simulate a CI checkout that persisted the token scoped to
    // the same URL *without* `.git` (a path mismatch). beachball treats this as non-applicable and
    // doesn't reset it; this verifies real git also doesn't *send* it to the `.git` URL (no leak).
    const mismatchedKey = `http.${remoteUrl.replace(/\.git$/, '')}.extraheader`;
    const staleAuth = `AUTHORIZATION: basic ${Buffer.from('x-access-token:mismatched-stale-token').toString('base64')}`;
    repo.git(['config', '--add', mismatchedKey, staleAuth]);

    const gitToken = 'my-token';
    const authEnv = getGitAuthEnv({ gitToken, path: repo.rootPath, remote: 'origin', env: {}, operation: 'push' });

    const result = await gitAsync(
      [
        '-c',
        'credential.helper=',
        '-c',
        'credential.interactive=false',
        'push',
        '--no-verify',
        '--follow-tags',
        '--verbose',
        'origin',
        `HEAD:refs/heads/${defaultBranchName}`,
      ],
      {
        cwd: repo.rootPath,
        env: { ...authEnv, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' },
        verbose: false,
        timeout: 3000,
      }
    );

    expect(result.success).toBe(false);
    expect(capturedRequests.length).toBeGreaterThan(0);

    const headers = firstRequestHeaders();

    // Only our injected auth header reaches the wire; the mismatched-path stale header is not sent.
    const authHeaders = headers.filter(h => h.name === 'authorization');
    expect(authHeaders).toHaveLength(1);
    expect(getTokenFromAuthHeader(`Authorization: ${authHeaders[0].value}`)).toBe(gitToken);

    const wire = JSON.stringify(capturedRequests);
    expect(wire).not.toContain(gitToken);
    expect(wire).not.toContain('mismatched-stale-token');
  });

  it('resets less-specific headers (base + host) but keeps a non-auth header re-added at the remote key', async () => {
    const repo = repositoryFactory.cloneRepository();
    repo.git(['remote', 'set-url', 'origin', remoteUrl]);

    // Seed stale auth + a non-auth header at *less-specific* scopes than the exact remote URL:
    // - the base `http.extraheader` (applies to all URLs)
    // - a host-scoped `http.<host>/.extraheader` (applies to any path on the host)
    // Absent our logic, git would send all of these to the remote (extraheader accumulates).
    const hostKey = `http.${remoteUrl.replace(/repo\.git$/, '')}.extraheader`; // http.http://127.0.0.1:PORT/.extraheader
    const baseStale = `AUTHORIZATION: basic ${Buffer.from('x-access-token:base-stale-token').toString('base64')}`;
    const hostStale = `AUTHORIZATION: basic ${Buffer.from('x-access-token:host-stale-token').toString('base64')}`;
    repo.git(['config', '--add', 'http.extraheader', baseStale]);
    repo.git(['config', '--add', 'http.extraheader', 'X-Base-Keep: base-value']);
    repo.git(['config', '--add', hostKey, hostStale]);

    const gitToken = 'my-token';
    const authEnv = getGitAuthEnv({ gitToken, path: repo.rootPath, remote: 'origin', env: {}, operation: 'push' });

    const result = await gitAsync(
      [
        '-c',
        'credential.helper=',
        '-c',
        'credential.interactive=false',
        'push',
        '--no-verify',
        '--follow-tags',
        '--verbose',
        'origin',
        `HEAD:refs/heads/${defaultBranchName}`,
      ],
      {
        cwd: repo.rootPath,
        env: { ...authEnv, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' },
        verbose: false,
        timeout: 3000,
      }
    );

    expect(result.success).toBe(false);
    expect(capturedRequests.length).toBeGreaterThan(0);

    const headers = firstRequestHeaders();

    // The empty reset lives at the most-specific (remote URL) key, so it wipes the base- and
    // host-scoped accumulations: only our injected token reaches the wire.
    const authHeaders = headers.filter(h => h.name === 'authorization');
    expect(authHeaders).toHaveLength(1);
    expect(getTokenFromAuthHeader(`Authorization: ${authHeaders[0].value}`)).toBe(gitToken);

    // The base-level non-auth header survives exactly once: its original base occurrence was wiped
    // by the reset, and it's present only because we re-added it under the remote URL key.
    expect(headers.filter(h => h.name === 'x-base-keep')).toEqual([{ name: 'x-base-keep', value: 'base-value' }]);

    // Neither the base nor host stale token (nor the real token in plaintext) reaches the wire.
    const wire = JSON.stringify(capturedRequests);
    expect(wire).not.toContain(gitToken);
    expect(wire).not.toContain('base-stale-token');
    expect(wire).not.toContain('host-stale-token');
  });
});
