import { describe, expect, it } from '@jest/globals';
import { createGitHubAppAuth } from '../../githubAuth/api';
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
} from './authTestHelpers';

describe('createGitHubAppAuth', () => {
  describe('getInstallationToken', () => {
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

      const { token } = await auth.getInstallationToken({ owner: 'test-org' });
      expect(token).toEqual(mockToken);
    });

    it('falls back to user installation when org returns 404', async () => {
      const { mockAgent, mockPool } = createMockPool();

      mockPool
        .intercept({ path: '/orgs/test-user/installation', method: 'GET' })
        .reply(404, { message: 'Not Found' }, { headers: { 'content-type': 'application/json' } });
      mockPool
        .intercept({ path: '/users/test-user/installation', method: 'GET' })
        .reply(
          200,
          { id: mockInstallationId, app_slug: mockAppSlug },
          { headers: { 'content-type': 'application/json' } }
        );
      mockAccessToken(mockPool);

      const auth = createGitHubAppAuth({
        appClientId: 'Iv1.test-client-id',
        signer: mockSigner,
      });

      const { token } = await auth.getInstallationToken({ owner: 'test-user' });
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

      mockPool
        .intercept({ path: '/enterprises/test-enterprise/installation', method: 'GET' })
        .reply(
          200,
          { id: mockInstallationId, app_slug: mockAppSlug },
          { headers: { 'content-type': 'application/json' } }
        );
      mockAccessToken(mockPool);

      const auth = createGitHubAppAuth({
        appClientId: 'Iv1.test-client-id',
        signer: mockSigner,
      });

      const { token } = await auth.getInstallationToken({ enterprise: 'test-enterprise' });
      expect(token).toEqual(mockToken);
    });

    it('rejects enterprise combined with owner', async () => {
      const { mockPool } = createMockPool();
      const auth = createTestAuth(mockPool, 'x', 'y');

      await expect(auth.getInstallationToken({ enterprise: 'e', owner: 'o' })).rejects.toThrow(
        /Cannot use 'enterprise'/
      );
    });

    it('rejects enterprise combined with repositories', async () => {
      const { mockPool } = createMockPool();
      const auth = createTestAuth(mockPool, 'x', 'y');

      await expect(auth.getInstallationToken({ enterprise: 'e', repositories: ['r'] })).rejects.toThrow(
        /Cannot use 'enterprise'/
      );
    });

    it('rejects missing appClientId', () => {
      expect(() => createGitHubAppAuth({ appClientId: '', signer: mockSigner })).toThrow(/appClientId is required/);
    });

    it('rejects missing signer', () => {
      // eslint-disable-next-line
      expect(() => createGitHubAppAuth({ appClientId: 'id', signer: undefined as any })).toThrow(
        /'signer' or 'keyId' is required/
      );
    });

    it('validates permission levels', async () => {
      const { mockPool } = createMockPool();
      const auth = createTestAuth(mockPool, 'o', 'r');

      await expect(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
        auth.getInstallationToken({ owner: 'o', repositories: ['r'], permissions: { contents: 'invalid' as any } })
      ).rejects.toThrow(/Invalid permission level/);
    });

    it('validates permission names', async () => {
      const { mockPool } = createMockPool();
      const auth = createTestAuth(mockPool, 'o', 'r');

      await expect(
        auth.getInstallationToken({ owner: 'o', repositories: ['r'], permissions: { 'bad name!': 'read' } })
      ).rejects.toThrow(/Invalid permission name/);
    });

    it('infers owner from an owner/repo entry when owner is omitted', async () => {
      const { mockPool } = createMockPool();
      mockRepoInstallation(mockPool, 'my-org', 'my-repo');
      mockAccessToken(mockPool);

      const auth = createGitHubAppAuth({
        appClientId: 'Iv1.test-client-id',
        signer: mockSigner,
      });

      const result = await auth.getInstallationToken({ repositories: ['my-org/my-repo'] });
      expect(result.token).toBe(mockToken);
      expect(result.repositories).toEqual(['my-repo']);
    });

    it('infers owner from multiple owner/repo entries with the same owner', async () => {
      const { mockPool } = createMockPool();
      // Installation is discovered from the first repository.
      mockRepoInstallation(mockPool, 'my-org', 'repo-a');
      mockAccessToken(mockPool);

      const auth = createGitHubAppAuth({
        appClientId: 'Iv1.test-client-id',
        signer: mockSigner,
      });

      const result = await auth.getInstallationToken({ repositories: ['my-org/repo-a', 'my-org/repo-b'] });
      expect(result.token).toBe(mockToken);
      expect(result.repositories).toEqual(['repo-a', 'repo-b']);
    });

    it('rejects owner/repo entries with mismatched owners', async () => {
      createMockPool();

      const auth = createGitHubAppAuth({
        appClientId: 'Iv1.test-client-id',
        signer: mockSigner,
      });

      await expect(auth.getInstallationToken({ repositories: ['org-a/repo', 'org-b/repo'] })).rejects.toThrow(
        /does not match/
      );
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

      const { token } = await auth.getInstallationToken({
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

      await expect(auth.getInstallationToken({ owner: 'o', repositories: ['r'] })).rejects.toThrow(/403/);
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
        signer: mockSigner,
        githubApiUrl: 'https://ghe.example.com/api/v3',
      });

      const { token } = await auth.getInstallationToken({ owner: 'o', repositories: ['r'] });
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

      const { token: t1 } = await auth.getInstallationToken({ owner: 'o', repositories: ['r'] });
      const { token: t2 } = await auth.getInstallationToken({ owner: 'o', repositories: ['r'] });
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

      const { token: t1 } = await auth.getInstallationToken({ owner: 'o', repositories: ['r'] });
      const { token: t2 } = await auth.getInstallationToken({ owner: 'o', repositories: ['r'] });
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

      await expect(auth.getInstallationToken({ owner: 'o', repositories: ['r'] })).rejects.toThrow(/invalid JSON/);
    });

    it('re-throws non-404 errors during org installation lookup', async () => {
      const { mockPool } = createMockPool();

      // 403 is not retryable and not 404, so it should re-throw immediately
      mockPool.intercept({ path: '/orgs/o/installation', method: 'GET' }).reply(403, 'Forbidden');

      const auth = createGitHubAppAuth({
        appClientId: 'Iv1.test-client-id',
        signer: mockSigner,
      });

      await expect(auth.getInstallationToken({ owner: 'o' })).rejects.toThrow(/403/);
    });
  });

  describe('revokeToken', () => {
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

    it('throws on failed revocation', async () => {
      const { mockPool } = createMockPool();

      mockPool.intercept({ path: '/installation/token', method: 'DELETE' }).reply(401, 'Unauthorized');

      const auth = createGitHubAppAuth({
        appClientId: 'Iv1.test-client-id',
        signer: mockSigner,
      });

      await expect(auth.revokeToken('ghs_bad_token')).rejects.toThrow(/Could not revoke/);
    });
  });
});
