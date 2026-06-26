import { describe, it, expect } from '@jest/globals';
import {
  createGitHubAppAuth,
  normalizeRepositoryTarget,
  parseRepositoryInput,
  splitRepositoryNames,
} from '../../githubAuth/api.js';
import {
  createMockPool,
  createTestAuth,
  mockAccessToken,
  mockAppSlug,
  mockExpiresAt,
  mockInstallationId,
  mockOrgInstallation,
  mockRepoInstallation,
  mockSigner,
  mockToken,
} from './helpers.js';

describe('input parsing', () => {
  describe('normalizeRepositoryTarget', () => {
    it('uses explicit owner', () => {
      const result = normalizeRepositoryTarget('my-org', ['repo-a'], undefined);
      expect(result.owner).toBe('my-org');
      expect(result.repositories).toEqual(['repo-a']);
    });

    it('falls back to defaultOwner', () => {
      const result = normalizeRepositoryTarget(undefined, ['repo-a'], 'default-org');
      expect(result.owner).toBe('default-org');
    });

    it('infers owner from owner/repo entry', () => {
      const result = normalizeRepositoryTarget(undefined, ['inferred-org/repo-a'], undefined);
      expect(result.owner).toBe('inferred-org');
      expect(result.repositories).toEqual(['repo-a']);
    });

    it('rejects owner mismatch', () => {
      expect(() => normalizeRepositoryTarget('org-a', ['org-b/repo'], undefined)).toThrow(/does not match/);
    });

    it('rejects missing owner entirely', () => {
      expect(() => normalizeRepositoryTarget(undefined, ['repo'], undefined)).toThrow(/owner is required/);
    });
  });

  describe('splitRepositoryNames', () => {
    // Test the parsePermissions function indirectly through splitRepositoryNames and validators
    // imported from api.ts
    it('handles comma-separated', () => {
      expect(splitRepositoryNames('repo-a, repo-b, repo-c')).toEqual(['repo-a', 'repo-b', 'repo-c']);
    });

    it('handles newline-separated', () => {
      expect(splitRepositoryNames('repo-a\nrepo-b\nrepo-c')).toEqual(['repo-a', 'repo-b', 'repo-c']);
    });

    it('handles arrays', () => {
      expect(splitRepositoryNames(['repo-a', 'repo-b'])).toEqual(['repo-a', 'repo-b']);
    });

    it('returns empty for undefined', () => {
      expect(splitRepositoryNames(undefined)).toEqual([]);
    });
  });

  describe('parseRepositoryInput', () => {
    it('parses bare repo name', () => {
      const result = parseRepositoryInput('my-repo');
      expect(result.name).toBe('my-repo');
      expect(result.owner).toBeUndefined();
    });

    it('parses owner/repo format', () => {
      const result = parseRepositoryInput('my-org/my-repo');
      expect(result.owner).toBe('my-org');
      expect(result.name).toBe('my-repo');
    });

    it('rejects invalid format', () => {
      expect(() => parseRepositoryInput('a/b/c')).toThrow(/Invalid repository/);
    });
  });
});

describe('createGitHubAppAuth', () => {
  it('getToken returns a token for owner + repository', async () => {
    const { mockPool } = createMockPool();
    const auth = createTestAuth(mockPool, 'test-owner', 'test-repo');

    const token = await auth.getToken({
      owner: 'test-owner',
      repositories: ['test-repo'],
      permissions: { contents: 'read' },
    });

    expect(token).toEqual(mockToken);
  });

  it('getInstallationToken returns full token info', async () => {
    const { mockPool } = createMockPool();
    const auth = createTestAuth(mockPool, 'test-owner', 'test-repo');

    const result = await auth.getInstallationToken({
      owner: 'test-owner',
      repositories: ['test-repo'],
      permissions: { contents: 'read' },
    });

    expect(result.token).toEqual(mockToken);
    expect(result.expiresAt).toEqual(mockExpiresAt);
    expect(result.installationId).toEqual(mockInstallationId);
    expect(result.appSlug).toEqual(mockAppSlug);
    expect(result.repositories).toEqual(['test-repo']);
  });

  it('discovers org installation when owner set without repositories', async () => {
    const { mockPool } = createMockPool();
    mockOrgInstallation(mockPool, 'test-org');
    mockAccessToken(mockPool);

    const auth = createGitHubAppAuth({
      appClientId: 'Iv1.test-client-id',
      signer: mockSigner,
    });

    const token = await auth.getToken({ owner: 'test-org' });
    expect(token).toEqual(mockToken);
  });

  it('falls back to user installation when org returns 404', async () => {
    const { mockAgent, mockPool } = createMockPool();

    mockPool
      .intercept({ path: '/orgs/test-user/installation', method: 'GET' })
      .reply(404, { message: 'Not Found' }, { headers: { 'content-type': 'application/json' } });
    mockPool.intercept({ path: '/users/test-user/installation', method: 'GET' }).reply(
      200,
      { id: mockInstallationId, app_slug: mockAppSlug },
      {
        headers: { 'content-type': 'application/json' },
      }
    );
    mockAccessToken(mockPool);

    const auth = createGitHubAppAuth({
      appClientId: 'Iv1.test-client-id',
      signer: mockSigner,
    });

    const token = await auth.getToken({ owner: 'test-user' });
    expect(token).toEqual(mockToken);

    const paths = mockAgent
      .getCallHistory()!
      .calls()
      .map(c => c.path);
    expect(paths).toContain('/orgs/test-user/installation');
    expect(paths).toContain('/users/test-user/installation');
  });

  it('discovers enterprise installation', async () => {
    const { mockPool } = createMockPool();

    mockPool.intercept({ path: '/enterprises/test-enterprise/installation', method: 'GET' }).reply(
      200,
      { id: mockInstallationId, app_slug: mockAppSlug },
      {
        headers: { 'content-type': 'application/json' },
      }
    );
    mockAccessToken(mockPool);

    const auth = createGitHubAppAuth({
      appClientId: 'Iv1.test-client-id',
      signer: mockSigner,
    });

    const token = await auth.getToken({ enterprise: 'test-enterprise' });
    expect(token).toEqual(mockToken);
  });

  it('rejects enterprise combined with owner', async () => {
    const { mockPool } = createMockPool();
    const auth = createTestAuth(mockPool, 'x', 'y');

    await expect(auth.getToken({ enterprise: 'e', owner: 'o' })).rejects.toThrow(/Cannot use 'enterprise'/);
  });

  it('rejects enterprise combined with repositories', async () => {
    const { mockPool } = createMockPool();
    const auth = createTestAuth(mockPool, 'x', 'y');

    await expect(auth.getToken({ enterprise: 'e', repositories: ['r'] })).rejects.toThrow(/Cannot use 'enterprise'/);
  });

  it('rejects missing appClientId', () => {
    expect(() => createGitHubAppAuth({ appClientId: '', signer: mockSigner })).toThrow(/appClientId is required/);
  });

  it('rejects missing signer', () => {
    // eslint-disable-next-line
    expect(() => createGitHubAppAuth({ appClientId: 'id', signer: undefined as any })).toThrow(/signer is required/);
  });

  it('validates permission levels', async () => {
    const { mockPool } = createMockPool();
    const auth = createTestAuth(mockPool, 'o', 'r');

    await expect(
      // eslint-disable-next-line
      auth.getToken({ owner: 'o', repositories: ['r'], permissions: { contents: 'invalid' as any } })
    ).rejects.toThrow(/Invalid permission level/);
  });

  it('validates permission names', async () => {
    const { mockPool } = createMockPool();
    const auth = createTestAuth(mockPool, 'o', 'r');

    await expect(
      auth.getToken({ owner: 'o', repositories: ['r'], permissions: { 'bad name!': 'read' } })
    ).rejects.toThrow(/Invalid permission name/);
  });

  it('parses owner/repo format in repositories via normalizeRepositoryTarget', async () => {
    const { mockPool } = createMockPool();

    const result = normalizeRepositoryTarget('my-org', ['my-org/my-repo'], undefined);
    expect(result.owner).toBe('my-org');
    expect(result.repositories).toEqual(['my-repo']);

    // Now use the normalized values with the API
    mockRepoInstallation(mockPool, 'my-org', 'my-repo');
    mockAccessToken(mockPool);

    const auth = createGitHubAppAuth({
      appClientId: 'Iv1.test-client-id',
      signer: mockSigner,
    });

    const token = await auth.getToken({ owner: result.owner, repositories: result.repositories });
    expect(token).toBe(mockToken);
  });

  it('uses defaultOwner when owner is omitted', async () => {
    const { mockPool } = createMockPool();
    mockRepoInstallation(mockPool, 'default-org', 'some-repo');
    mockAccessToken(mockPool);

    const auth = createGitHubAppAuth({
      appClientId: 'Iv1.test-client-id',
      signer: mockSigner,
      defaultOwner: 'default-org',
    });

    const token = await auth.getToken({ repositories: ['some-repo'] });
    expect(token).toBe(mockToken);
  });

  it('revokeToken calls DELETE /installation/token', async () => {
    const { mockAgent, mockPool } = createMockPool();

    mockPool.intercept({ path: '/installation/token', method: 'DELETE' }).reply(204);

    const auth = createGitHubAppAuth({
      appClientId: 'Iv1.test-client-id',
      signer: mockSigner,
    });

    await auth.revokeToken('ghs_some_token');

    const calls = mockAgent.getCallHistory()!.calls();
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('DELETE');
    expect(calls[0].path).toBe('/installation/token');
  });

  it('retries on 500 errors', async () => {
    const { mockPool } = createMockPool();

    // First attempt: 500
    mockPool.intercept({ path: '/repos/o/r/installation', method: 'GET' }).reply(500, 'Internal Server Error');
    // Second attempt: success
    mockRepoInstallation(mockPool, 'o', 'r');
    mockAccessToken(mockPool);

    const auth = createGitHubAppAuth({
      appClientId: 'Iv1.test-client-id',
      signer: mockSigner,
    });

    const token = await auth.getToken({
      owner: 'o',
      repositories: ['r'],
    });
    expect(token).toBe(mockToken);
  });

  it('does not retry on 4xx errors', async () => {
    const { mockPool } = createMockPool();

    mockPool.intercept({ path: '/repos/o/r/installation', method: 'GET' }).reply(403, 'Forbidden');

    const auth = createGitHubAppAuth({
      appClientId: 'Iv1.test-client-id',
      signer: mockSigner,
    });

    await expect(auth.getToken({ owner: 'o', repositories: ['r'] })).rejects.toThrow(/403/);
  });

  it('works with custom githubApiUrl', async () => {
    const { mockPool } = createMockPool('https://ghe.example.com');

    mockPool.intercept({ path: '/api/v3/repos/o/r/installation', method: 'GET' }).reply(
      200,
      { id: mockInstallationId, app_slug: mockAppSlug },
      {
        headers: { 'content-type': 'application/json' },
      }
    );
    mockPool.intercept({ path: `/api/v3/app/installations/${mockInstallationId}/access_tokens`, method: 'POST' }).reply(
      201,
      { token: mockToken, expires_at: mockExpiresAt },
      {
        headers: { 'content-type': 'application/json' },
      }
    );

    const auth = createGitHubAppAuth({
      appClientId: 'Iv1.test-client-id',
      signer: mockSigner,
      githubApiUrl: 'https://ghe.example.com/api/v3',
    });

    const token = await auth.getToken({ owner: 'o', repositories: ['r'] });
    expect(token).toBe(mockToken);
  });

  it('caches installation discovery across calls', async () => {
    const { mockPool } = createMockPool();
    mockRepoInstallation(mockPool, 'o', 'r');
    // Two token mints, but only one installation lookup
    mockAccessToken(mockPool);
    mockAccessToken(mockPool);

    const auth = createGitHubAppAuth({
      appClientId: 'Iv1.test-client-id',
      signer: mockSigner,
      refreshWindowMs: 0,
    });

    const t1 = await auth.getToken({ owner: 'o', repositories: ['r'] });
    const t2 = await auth.getToken({ owner: 'o', repositories: ['r'] });
    expect(t1).toBe(mockToken);
    expect(t2).toBe(mockToken);
  });

  it('returns cached token when not expired', async () => {
    const { mockPool } = createMockPool();
    mockRepoInstallation(mockPool, 'o', 'r');
    // Only one access token mock — second call should use cache
    mockAccessToken(mockPool);

    const auth = createGitHubAppAuth({
      appClientId: 'Iv1.test-client-id',
      signer: mockSigner,
    });

    const t1 = await auth.getToken({ owner: 'o', repositories: ['r'] });
    const t2 = await auth.getToken({ owner: 'o', repositories: ['r'] });
    expect(t1).toBe(mockToken);
    expect(t2).toBe(mockToken);
  });

  it('throws on invalid JSON response', async () => {
    const { mockPool } = createMockPool();

    mockPool
      .intercept({ path: '/repos/o/r/installation', method: 'GET' })
      .reply(200, 'not json', { headers: { 'content-type': 'text/plain' } });

    const auth = createGitHubAppAuth({
      appClientId: 'Iv1.test-client-id',
      signer: mockSigner,
    });

    await expect(auth.getToken({ owner: 'o', repositories: ['r'] })).rejects.toThrow(/invalid JSON/);
  });

  it('throws on failed revocation', async () => {
    const { mockPool } = createMockPool();

    mockPool.intercept({ path: '/installation/token', method: 'DELETE' }).reply(401, 'Unauthorized');

    const auth = createGitHubAppAuth({
      appClientId: 'Iv1.test-client-id',
      signer: mockSigner,
    });

    await expect(auth.revokeToken('ghs_bad_token')).rejects.toThrow(/Could not revoke/);
  });

  it('re-throws non-404 errors during org installation lookup', async () => {
    const { mockPool } = createMockPool();

    // 403 is not retryable and not 404, so it should re-throw immediately
    mockPool.intercept({ path: '/orgs/o/installation', method: 'GET' }).reply(403, 'Forbidden');

    const auth = createGitHubAppAuth({
      appClientId: 'Iv1.test-client-id',
      signer: mockSigner,
    });

    await expect(auth.getToken({ owner: 'o' })).rejects.toThrow(/403/);
  });
});
