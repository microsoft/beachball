import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { generateKeyPairSync, verify } from 'node:crypto';
import type { Interceptable, MockAgent } from 'undici';
import { _signWithPrivateKey, createAppToken } from '../../authHelper/createAppToken';
import {
  createMockPool,
  mockAccessToken,
  mockAppSlug,
  mockExpiresAt,
  mockInstallationId,
  mockKeyId,
  mockRepoInstallation,
  mockToken,
} from './authTestHelpers';

jest.mock('../../authHelper/signWithAzureCli', () => ({
  signWithAzureCli: () => Promise.resolve('mock-signature-base64url'),
}));

describe('_signWithPrivateKey', () => {
  it('signs with an escaped-newline PEM private key', () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString().replace(/\n/g, '\\n');
    const signingInput = 'header.payload';

    const signature = _signWithPrivateKey(privateKeyPem, signingInput);

    expect(verify('RSA-SHA256', Buffer.from(signingInput), publicKey, Buffer.from(signature, 'base64url'))).toBe(true);
  });
});

describe('createAppToken', () => {
  const owner = 'my-org';
  const repo = 'my-repo';
  let mockPool: Interceptable;
  let mockAgent: MockAgent;

  beforeEach(() => {
    ({ mockPool, mockAgent } = createMockPool());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates a token', async () => {
    mockRepoInstallation(mockPool, owner, repo);
    mockAccessToken(mockPool);
    const result = await createAppToken({
      appClientId: 'Iv1.test-client-id',
      keyInfo: { keyId: mockKeyId },
      repository: { owner, name: repo },
      permissions: { contents: 'read' },
    });
    expect(result).toEqual(mockToken);
  });

  it('retries on 500 errors', async () => {
    jest.useFakeTimers({ doNotFake: ['queueMicrotask'] });
    // First attempt: 500
    mockPool.intercept({ path: '/repos/o/r/installation', method: 'GET' }).reply(500, 'Internal Server Error');
    // Second attempt: success
    mockRepoInstallation(mockPool, 'o', 'r');
    mockAccessToken(mockPool);

    const tokenPromise = createAppToken({
      appClientId: 'Iv1.test-client-id',
      keyInfo: { keyId: mockKeyId },
      repository: { owner: 'o', name: 'r' },
    });
    await Promise.all([tokenPromise, jest.runAllTimersAsync()]);
    const result = await tokenPromise;
    expect(result).toBe(mockToken);

    // The installation lookup should have been attempted twice (500, then success).
    const lookups = mockAgent
      .getCallHistory()!
      .calls()
      .filter(call => call.path === '/repos/o/r/installation');
    expect(lookups).toHaveLength(2);
  });

  it('does not retry on 4xx errors', async () => {
    mockPool.intercept({ path: '/repos/o/r/installation', method: 'GET' }).reply(403, 'Forbidden');

    await expect(
      createAppToken({
        appClientId: 'Iv1.test-client-id',
        keyInfo: { keyId: mockKeyId },
        repository: { owner: 'o', name: 'r' },
      })
    ).rejects.toThrow(/403/);

    // A 4xx must not be retried, so exactly one request should have been made.
    const lookups = mockAgent
      .getCallHistory()!
      .calls()
      .filter(call => call.path === '/repos/o/r/installation');
    expect(lookups).toHaveLength(1);
  });

  it('works with custom githubApiUrl', async () => {
    ({ mockPool, mockAgent } = createMockPool('https://ghe.example.com'));

    mockPool
      .intercept({ path: '/api/v3/repos/o/r/installation', method: 'GET' })
      .reply(
        200,
        { id: mockInstallationId, app_slug: mockAppSlug },
        { headers: { 'content-type': 'application/json' } }
      );
    mockPool
      .intercept({ path: `/api/v3/app/installations/${mockInstallationId}/access_tokens`, method: 'POST' })
      .reply(201, { token: mockToken, expires_at: mockExpiresAt }, { headers: { 'content-type': 'application/json' } });

    const token = await createAppToken({
      appClientId: 'Iv1.test-client-id',
      keyInfo: { keyId: mockKeyId },
      githubApiUrl: 'https://ghe.example.com/api/v3',
      repository: { owner: 'o', name: 'r' },
    });
    expect(token).toBe(mockToken);
  });

  it('reuses successful installation discovery when token creation is retried', async () => {
    jest.useFakeTimers({ doNotFake: ['queueMicrotask'] });
    mockRepoInstallation(mockPool, 'o', 'r');
    mockPool
      .intercept({ path: `/app/installations/${mockInstallationId}/access_tokens`, method: 'POST' })
      .reply(500, 'Internal Server Error');
    mockAccessToken(mockPool);

    const tokenPromise = createAppToken({
      appClientId: 'Iv1.test-client-id',
      keyInfo: { keyId: mockKeyId },
      repository: { owner: 'o', name: 'r' },
    });
    await jest.runAllTimersAsync();
    const token = await tokenPromise;

    expect(token).toBe(mockToken);

    const calls = mockAgent.getCallHistory()!.calls();
    expect(calls.filter(call => call.path === '/repos/o/r/installation')).toHaveLength(1);
    expect(calls.filter(call => call.path === `/app/installations/${mockInstallationId}/access_tokens`)).toHaveLength(
      2
    );
  });

  it('throws on invalid JSON response', async () => {
    mockPool
      .intercept({ path: '/repos/o/r/installation', method: 'GET' })
      .reply(200, 'not json', { headers: { 'content-type': 'text/plain' } });

    await expect(
      createAppToken({
        appClientId: 'Iv1.test-client-id',
        keyInfo: { keyId: mockKeyId },
        repository: { owner: 'o', name: 'r' },
      })
    ).rejects.toThrow(/invalid JSON/);
  });

  it('propagates a failure when minting the access token', async () => {
    // Installation lookup succeeds, but the token mint returns a non-retryable 403.
    mockRepoInstallation(mockPool, 'o', 'r');
    mockPool
      .intercept({ path: `/app/installations/${mockInstallationId}/access_tokens`, method: 'POST' })
      .reply(403, 'Forbidden');

    await expect(
      createAppToken({
        appClientId: 'Iv1.test-client-id',
        keyInfo: { keyId: mockKeyId },
        repository: { owner: 'o', name: 'r' },
      })
    ).rejects.toThrow(/Could not create.*403/);
  });
});
