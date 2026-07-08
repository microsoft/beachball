import { install, MockAgent, setGlobalDispatcher, type Interceptable } from 'undici';
import { createAppTokenHelper } from '../../githubAuth/createAppTokenHelper';
import type { AppTokenHelper, AppTokenHelperOptions } from '../../githubAuth/types';

install();

export const mockInstallationId = 123456;
export const mockAppSlug = 'test-app';
export const mockToken = 'ghs_test_installation_token_0123456789';
export const mockExpiresAt = '2099-01-01T00:00:00Z';
export const mockKeyId = 'https://my-vault.vault.azure.net/keys/test-key';

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

export function mockRepoInstallation(mockPool: ReturnType<MockAgent['get']>, owner: string, repo: string): void {
  mockPool.intercept({ path: `/repos/${owner}/${repo}/installation`, method: 'GET' }).reply(
    200,
    { id: mockInstallationId, app_slug: mockAppSlug },
    {
      headers: { 'content-type': 'application/json' },
    }
  );
}

export function mockAccessToken(mockPool: ReturnType<MockAgent['get']>): void {
  mockPool
    .intercept({
      path: `/app/installations/${mockInstallationId}/access_tokens`,
      method: 'POST',
    })
    .reply(
      201,
      { token: mockToken, expires_at: mockExpiresAt, permissions: { contents: 'read' } },
      {
        headers: { 'content-type': 'application/json' },
      }
    );
}

export function createTestAuth(
  mockPool: ReturnType<MockAgent['get']>,
  owner: string,
  repo: string,
  overrides?: Partial<AppTokenHelperOptions>
): AppTokenHelper {
  mockRepoInstallation(mockPool, owner, repo);
  mockAccessToken(mockPool);

  return createAppTokenHelper({
    appClientId: 'Iv1.test-client-id',
    keyId: mockKeyId,
    ...overrides,
  });
}
