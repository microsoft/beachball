import { install, MockAgent, setGlobalDispatcher, type Interceptable } from 'undici';
import type { GitHubAccessTokenResponse, GitHubAppInstallationResponse } from '../../githubAuth/createAppToken';

install();

export const mockInstallationId = 123456;
export const mockAppSlug = 'test-app';
export const mockToken = 'ghs_test_installation_token_0123456789';
export const mockExpiresAt = '2099-01-01T00:00:00Z';
export const mockKeyId = 'https://my-vault.vault.azure.net/keys/test-key';

/** Create an isolated Undici mock pool and reject unmocked network requests. */
export function createMockPool(origin = 'https://api.github.com'): {
  mockAgent: MockAgent;
  mockPool: Interceptable;
} {
  const mockAgent = new MockAgent({ enableCallHistory: true });
  mockAgent.disableNetConnect();
  setGlobalDispatcher(mockAgent);
  const mockPool = mockAgent.get(origin);
  return { mockAgent, mockPool };
}

/** Mock repository app installation discovery request for the given owner and repository. */
export function mockRepoInstallation(mockPool: Interceptable, owner: string, repo: string): void {
  mockPool
    .intercept({ path: `/repos/${owner}/${repo}/installation`, method: 'GET' })
    .reply<GitHubAppInstallationResponse>(
      200,
      { id: mockInstallationId, app_slug: mockAppSlug },
      { headers: { 'content-type': 'application/json' } }
    );
}

/** Mock creation of a GitHub App installation access token. */
export function mockAccessToken(mockPool: Interceptable): void {
  mockPool
    .intercept({
      path: `/app/installations/${mockInstallationId}/access_tokens`,
      method: 'POST',
    })
    .reply<GitHubAccessTokenResponse>(
      201,
      { token: mockToken, expires_at: mockExpiresAt, permissions: { contents: 'read' } },
      { headers: { 'content-type': 'application/json' } }
    );
}
