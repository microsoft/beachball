import type { AuthenticationResult, ConfidentialClientApplication, NodeAuthOptions } from '@azure/msal-node';
import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { expectError } from '@microsoft/beachball-test-utilities';
import { MockLogger } from '../__fixtures__/MockLogger.ts';
import { generateTestCert, isOpensslAvailable, type TestCert } from '../__fixtures__/testCert.ts';
import type { GetAadTokenParams } from '../auth/getAadToken.ts';
import { ReleaseError } from '../utils/ReleaseError.ts';

let lastAuthOptions: NodeAuthOptions | undefined;
const acquireTokenByClientCredential = jest.fn<ConfidentialClientApplication['acquireTokenByClientCredential']>();
const { ServerError, AuthError, ClientAuthErrorCodes } = await import('@azure/msal-node');

jest.unstable_mockModule('@azure/msal-node', () => ({
  ServerError,
  AuthError,
  ClientAuthErrorCodes,
  ConfidentialClientApplication: jest.fn((opts: { auth: NodeAuthOptions }) => {
    lastAuthOptions = opts.auth;
    return { acquireTokenByClientCredential };
  }),
}));

const { getAadToken } = await import('../auth/getAadToken.ts');

// eslint-disable-next-line no-restricted-properties
const describeIfOpenssl = (await isOpensslAvailable()) ? describe : describe.skip;

describe('getAadToken', () => {
  let logger: MockLogger;

  const scopes = ['https://sample.microsoft.com/.default'];
  const baseParams: Pick<GetAadTokenParams, 'clientId' | 'tenantId' | 'scopes'> = {
    clientId: 'client-id',
    tenantId: 'tenant-id',
    scopes,
  };

  function makeAuthResult(overrides: Partial<AuthenticationResult> = {}): AuthenticationResult {
    return {
      accessToken: 'access-token',
      expiresOn: new Date('2099-01-01T00:00:00Z'),
      ...overrides,
    } as AuthenticationResult;
  }

  beforeEach(() => {
    acquireTokenByClientCredential.mockReset();
    lastAuthOptions = undefined;
    logger = new MockLogger();
  });

  describe('idToken (federated) auth', () => {
    it('passes the idToken as clientAssertion and acquires the token with the correct scope', async () => {
      acquireTokenByClientCredential.mockResolvedValue(makeAuthResult());

      const result = await getAadToken({
        ...baseParams,
        auth: { idToken: 'federated-id-token' },
        logger,
      });

      expect(result).toEqual({
        token: 'access-token',
        expiresOnTimestamp: new Date('2099-01-01T00:00:00Z').getTime(),
        refreshAfterTimestamp: undefined,
      });
      expect(lastAuthOptions).toEqual({
        clientId: 'client-id',
        authority: 'https://login.microsoftonline.com/tenant-id',
        clientAssertion: 'federated-id-token',
      });
      expect(acquireTokenByClientCredential).toHaveBeenCalledWith({ scopes });
    });

    it('forwards refreshAfterTimestamp when MSAL returns refreshOn', async () => {
      const refreshOn = new Date('2099-01-01T00:30:00Z');
      acquireTokenByClientCredential.mockResolvedValue(makeAuthResult({ refreshOn }));

      const result = await getAadToken({
        ...baseParams,
        auth: { idToken: 'tok' },
        logger,
      });

      expect(result.refreshAfterTimestamp).toBe(refreshOn.getTime());
    });
  });

  describeIfOpenssl('certificate (client-credentials) auth', () => {
    let testCert: TestCert;

    beforeAll(async () => {
      testCert = await generateTestCert();
    });

    it('extracts the leaf cert and key from the PFX and passes them as clientCertificate', async () => {
      acquireTokenByClientCredential.mockResolvedValue(makeAuthResult());

      await getAadToken({
        ...baseParams,
        auth: { certPfxContent: testCert.pfxBase64 },
        logger,
      });

      expect(lastAuthOptions).toEqual({
        clientId: 'client-id',
        authority: 'https://login.microsoftonline.com/tenant-id',
        clientCertificate: {
          // Independently-computed thumbprint of the leaf cert from testCert
          thumbprintSha256: testCert.sha256ThumbprintHex,
          privateKey: expect.stringMatching(/^-----BEGIN PRIVATE KEY-----[\s\S]+-----END PRIVATE KEY-----$/),
          // signing.ts extracts certs via regex, so any trailing newline from openssl is stripped
          x5c: testCert.leafCertPem.trimEnd(),
        },
      });
    });

    it('wraps PFX-parsing errors with a "parsing cert info" ReleaseError', async () => {
      await expectError(
        () => getAadToken({ ...baseParams, auth: { certPfxContent: 'not-a-real-pfx' }, logger }),
        ReleaseError,
        'Error parsing cert info to acquire token'
      );
      expect(acquireTokenByClientCredential).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it.each([
      ['network error', new AuthError(ClientAuthErrorCodes.networkError, '')],
      ['no network connectivity', new AuthError(ClientAuthErrorCodes.noNetworkConnectivity, '')],
      ['request timeout', new ServerError('unknown', '', undefined, undefined, undefined, 408)],
      ['throttling', new ServerError('unknown', '', undefined, undefined, undefined, 429)],
      ['server HTTP error', new ServerError('unknown', '', undefined, undefined, undefined, 599)],
    ])('marks transient MSAL %s failures as retryable', async (_description, originalError) => {
      acquireTokenByClientCredential.mockRejectedValue(originalError);

      const error = (await expectError(
        () => getAadToken({ ...baseParams, auth: { idToken: 'tok' }, logger }),
        ReleaseError,
        `Failed to acquire token for client "client-id" in tenant "tenant-id" with scope ${JSON.stringify(scopes)}`,
        originalError
      )) as ReleaseError;

      expect(error.retryable).toBe(true);
    });

    it.each([
      ['invalid client', new ServerError('invalid_client', '')],
      ['invalid tenant', new ServerError('invalid_tenant', '')],
      ['invalid scope', new ServerError('invalid_scope', '')],
      ['non-transient HTTP error', new ServerError('unknown', '', undefined, undefined, undefined, 400)],
      ['out-of-range HTTP status', new ServerError('unknown', '', undefined, undefined, undefined, 600)],
    ])('marks permanent MSAL %s failures as non-retryable', async (_description, originalError) => {
      acquireTokenByClientCredential.mockRejectedValue(originalError);

      const error = (await expectError(
        () => getAadToken({ ...baseParams, auth: { idToken: 'tok' }, logger }),
        ReleaseError,
        `Failed to acquire token for client "client-id" in tenant "tenant-id" with scope ${JSON.stringify(scopes)}`,
        originalError
      )) as ReleaseError;

      expect(error.retryable).toBe(false);
    });

    it('marks unknown token acquisition failures as non-retryable', async () => {
      acquireTokenByClientCredential.mockRejectedValue(new Error('oh no'));

      const error = (await expectError(
        () => getAadToken({ ...baseParams, auth: { idToken: 'tok' }, logger }),
        ReleaseError,
        'Failed to acquire token'
      )) as ReleaseError;

      expect(error.retryable).toBe(false);
    });

    it('throws ReleaseError when MSAL returns null (no token)', async () => {
      acquireTokenByClientCredential.mockResolvedValue(null);

      await expectError(
        () => getAadToken({ ...baseParams, auth: { idToken: 'tok' }, logger }),
        ReleaseError,
        'no result returned'
      );
    });

    it('throws ReleaseError when MSAL returns a result without expiresOn', async () => {
      acquireTokenByClientCredential.mockResolvedValue({ accessToken: 'tok' } as AuthenticationResult);

      await expectError(
        () => getAadToken({ ...baseParams, auth: { idToken: 'tok' }, logger }),
        ReleaseError,
        'no result returned'
      );
    });
  });
});
