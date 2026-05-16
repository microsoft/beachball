import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { AuthenticationResult, ConfidentialClientApplication, NodeAuthOptions } from '@azure/msal-node';
import { ReleaseError } from '../utils/ReleaseError.ts';
import { MockLogger } from '../__fixtures__/MockLogger.ts';
import { generateTestCert, isOpensslAvailable, type TestCert } from '../__fixtures__/testCert.ts';
import type { GetAadTokenParams } from '../utils/getAadToken.ts';

let lastAuthOptions: NodeAuthOptions | undefined;
const acquireTokenByClientCredential = jest.fn<ConfidentialClientApplication['acquireTokenByClientCredential']>();

jest.unstable_mockModule('@azure/msal-node', () => ({
  ConfidentialClientApplication: jest.fn((opts: { auth: NodeAuthOptions }) => {
    lastAuthOptions = opts.auth;
    return { acquireTokenByClientCredential };
  }),
}));

const { getAadToken } = await import('../utils/getAadToken.ts');

// eslint-disable-next-line no-restricted-properties
const describeIfOpenssl = isOpensslAvailable() ? describe : describe.skip;

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

    beforeAll(() => {
      testCert = generateTestCert();
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
      const err = await getAadToken({
        ...baseParams,
        auth: { certPfxContent: 'not-a-real-pfx' },
        logger,
      }).catch(e => e as unknown);

      expect(err).toBeInstanceOf(ReleaseError);
      expect((err as ReleaseError).message).toContain('Error parsing cert info to acquire token');
      expect(acquireTokenByClientCredential).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('wraps acquireTokenByClientCredential failures with ReleaseError preserving the cause', async () => {
      const originalError = new Error('oh no');
      acquireTokenByClientCredential.mockRejectedValue(originalError);

      const err = await getAadToken({
        ...baseParams,
        auth: { idToken: 'tok' },
        logger,
      }).catch(e => e as unknown);

      expect(err).toBeInstanceOf(ReleaseError);
      expect((err as ReleaseError).message).toEqual(
        `Failed to acquire token for client "client-id" in tenant "tenant-id" with scope ${JSON.stringify(scopes)}`
      );
      expect((err as ReleaseError).cause).toBe(originalError);
    });

    it('throws ReleaseError when MSAL returns null (no token)', async () => {
      acquireTokenByClientCredential.mockResolvedValue(null);

      const err = await getAadToken({ ...baseParams, auth: { idToken: 'tok' }, logger }).catch(e => e as unknown);

      expect(err).toBeInstanceOf(ReleaseError);
      expect((err as ReleaseError).message).toContain('no result returned');
    });

    it('throws ReleaseError when MSAL returns a result without expiresOn', async () => {
      acquireTokenByClientCredential.mockResolvedValue({ accessToken: 'tok' } as AuthenticationResult);

      const err = await getAadToken({
        ...baseParams,
        auth: { idToken: 'tok' },
        logger,
      }).catch(e => e as unknown);

      expect(err).toBeInstanceOf(ReleaseError);
      expect((err as ReleaseError).message).toContain('no result returned');
    });
  });
});
