import { describe, expect, it, jest } from '@jest/globals';
import { createGitHubAppAuth } from '../../githubAuth/appTokenAuth';
import {
  createMockPool,
  createTestAuth,
  mockAccessToken,
  mockAppSlug,
  mockExpiresAt,
  mockInstallationId,
  mockKeyId,
  mockRepoInstallation,
  mockToken,
} from './authTestHelpers';

jest.mock('../../githubAuth/signWithAzureCli', () => ({
  signWithAzureCli: () => Promise.resolve('mock-signature-base64url'),
}));

describe('createGitHubAppAuth', () => {
  describe('getInstallationToken', () => {
    it('getInstallationToken returns full token info', async () => {
      const { mockPool } = createMockPool();
      const auth = createTestAuth(mockPool, 'test-owner', 'test-repo');

      const result = await auth.getInstallationToken({
        repository: 'test-owner/test-repo',
        permissions: { contents: 'read' },
      });

      expect(result.token).toEqual(mockToken);
      expect(result.expiresAt).toEqual(mockExpiresAt);
      expect(result.installationId).toEqual(mockInstallationId);
      expect(result.appSlug).toEqual(mockAppSlug);
      expect(result.repositories).toEqual(['test-repo']);
      expect(result.permissions).toEqual({ contents: 'read' });
    });

    it('rejects a repository without an owner', async () => {
      const { mockPool } = createMockPool();
      const auth = createTestAuth(mockPool, 'o', 'r');

      await expect(auth.getInstallationToken({ repository: 'just-a-repo' })).rejects.toThrow(/Invalid repository/);
    });

    it('scopes the token to the single repository', async () => {
      const { mockPool } = createMockPool();
      mockRepoInstallation(mockPool, 'my-org', 'my-repo');
      mockAccessToken(mockPool);

      const auth = createGitHubAppAuth({
        appClientId: 'Iv1.test-client-id',
        keyId: mockKeyId,
      });

      const result = await auth.getInstallationToken({ repository: 'my-org/my-repo' });
      expect(result.token).toBe(mockToken);
      expect(result.repositories).toEqual(['my-repo']);
    });

    it('retries on 500 errors', async () => {
      const { mockAgent, mockPool } = createMockPool();

      // First attempt: 500
      mockPool.intercept({ path: '/repos/o/r/installation', method: 'GET' }).reply(500, 'Internal Server Error');
      // Second attempt: success
      mockRepoInstallation(mockPool, 'o', 'r');
      mockAccessToken(mockPool);

      const auth = createGitHubAppAuth({
        appClientId: 'Iv1.test-client-id',
        keyId: mockKeyId,
      });

      const { token } = await auth.getInstallationToken({
        repository: 'o/r',
      });
      expect(token).toBe(mockToken);

      // The installation lookup should have been attempted twice (500, then success).
      const lookups = mockAgent
        .getCallHistory()!
        .calls()
        .filter(call => call.path === '/repos/o/r/installation');
      expect(lookups).toHaveLength(2);
    });

    it('does not retry on 4xx errors', async () => {
      const { mockAgent, mockPool } = createMockPool();

      mockPool.intercept({ path: '/repos/o/r/installation', method: 'GET' }).reply(403, 'Forbidden');

      const auth = createGitHubAppAuth({
        appClientId: 'Iv1.test-client-id',
        keyId: mockKeyId,
      });

      await expect(auth.getInstallationToken({ repository: 'o/r' })).rejects.toThrow(/403/);

      // A 4xx must not be retried, so exactly one request should have been made.
      const lookups = mockAgent
        .getCallHistory()!
        .calls()
        .filter(call => call.path === '/repos/o/r/installation');
      expect(lookups).toHaveLength(1);
    });

    it('works with custom githubApiUrl', async () => {
      const { mockPool } = createMockPool('https://ghe.example.com');

      mockPool
        .intercept({ path: '/api/v3/repos/o/r/installation', method: 'GET' })
        .reply(
          200,
          { id: mockInstallationId, app_slug: mockAppSlug },
          { headers: { 'content-type': 'application/json' } }
        );
      mockPool
        .intercept({ path: `/api/v3/app/installations/${mockInstallationId}/access_tokens`, method: 'POST' })
        .reply(
          201,
          { token: mockToken, expires_at: mockExpiresAt },
          { headers: { 'content-type': 'application/json' } }
        );

      const auth = createGitHubAppAuth({
        appClientId: 'Iv1.test-client-id',
        keyId: mockKeyId,
        githubApiUrl: 'https://ghe.example.com/api/v3',
      });

      const { token } = await auth.getInstallationToken({ repository: 'o/r' });
      expect(token).toBe(mockToken);
    });

    it('caches installation discovery across calls', async () => {
      const { mockAgent, mockPool } = createMockPool();
      // Only one installation lookup and one token mint should occur across both calls.
      mockRepoInstallation(mockPool, 'o', 'r');
      mockAccessToken(mockPool);

      const auth = createGitHubAppAuth({
        appClientId: 'Iv1.test-client-id',
        keyId: mockKeyId,
      });

      const { token: t1 } = await auth.getInstallationToken({ repository: 'o/r' });
      const { token: t2 } = await auth.getInstallationToken({ repository: 'o/r' });
      expect(t1).toBe(mockToken);
      expect(t2).toBe(mockToken);

      const calls = mockAgent.getCallHistory()!.calls();
      expect(calls.filter(call => call.path === '/repos/o/r/installation')).toHaveLength(1);
      expect(calls.filter(call => call.path === `/app/installations/${mockInstallationId}/access_tokens`)).toHaveLength(
        1
      );
    });

    it('returns cached token when not expired', async () => {
      const { mockAgent, mockPool } = createMockPool();
      mockRepoInstallation(mockPool, 'o', 'r');
      // Only one access token mock — second call should use cache
      mockAccessToken(mockPool);

      const auth = createGitHubAppAuth({
        appClientId: 'Iv1.test-client-id',
        keyId: mockKeyId,
      });

      const { token: t1 } = await auth.getInstallationToken({ repository: 'o/r' });
      const { token: t2 } = await auth.getInstallationToken({ repository: 'o/r' });
      expect(t1).toBe(mockToken);
      expect(t2).toBe(mockToken);

      // The second call should reuse the cached token rather than minting a new one.
      const tokenMints = mockAgent
        .getCallHistory()!
        .calls()
        .filter(call => call.path === `/app/installations/${mockInstallationId}/access_tokens`);
      expect(tokenMints).toHaveLength(1);
    });

    it('throws on invalid JSON response', async () => {
      const { mockPool } = createMockPool();

      mockPool
        .intercept({ path: '/repos/o/r/installation', method: 'GET' })
        .reply(200, 'not json', { headers: { 'content-type': 'text/plain' } });

      const auth = createGitHubAppAuth({
        appClientId: 'Iv1.test-client-id',
        keyId: mockKeyId,
      });

      await expect(auth.getInstallationToken({ repository: 'o/r' })).rejects.toThrow(/invalid JSON/);
    });

    it('propagates a failure when minting the access token', async () => {
      const { mockPool } = createMockPool();

      // Installation lookup succeeds, but the token mint returns a non-retryable 403.
      mockRepoInstallation(mockPool, 'o', 'r');
      mockPool
        .intercept({ path: `/app/installations/${mockInstallationId}/access_tokens`, method: 'POST' })
        .reply(403, 'Forbidden');

      const auth = createGitHubAppAuth({
        appClientId: 'Iv1.test-client-id',
        keyId: mockKeyId,
      });

      await expect(auth.getInstallationToken({ repository: 'o/r' })).rejects.toThrow(/Could not create.*403/);
    });
  });

  describe('revokeToken', () => {
    it('revokeToken calls DELETE /installation/token', async () => {
      const { mockAgent, mockPool } = createMockPool();

      mockPool.intercept({ path: '/installation/token', method: 'DELETE' }).reply(204);

      const auth = createGitHubAppAuth({
        appClientId: 'Iv1.test-client-id',
        keyId: mockKeyId,
      });

      await auth.revokeToken('ghs_some_token');

      const calls = mockAgent.getCallHistory()!.calls();
      expect(calls).toHaveLength(1);
      expect(calls[0].method).toBe('DELETE');
      expect(calls[0].path).toBe('/installation/token');
    });

    it('throws on failed revocation', async () => {
      const { mockPool } = createMockPool();

      mockPool.intercept({ path: '/installation/token', method: 'DELETE' }).reply(401, 'Unauthorized');

      const auth = createGitHubAppAuth({
        appClientId: 'Iv1.test-client-id',
        keyId: mockKeyId,
      });

      await expect(auth.revokeToken('ghs_bad_token')).rejects.toThrow(/Could not revoke/);
    });
  });
});
