import { beforeAll, describe, expect, it } from '@jest/globals';
import jws from 'jws';
import { generateTestCert, isOpensslAvailable, type TestCert } from '../__fixtures__/testCert.ts';
import { generateJwsToken } from '../auth/generateJwsToken.ts';

// eslint-disable-next-line no-restricted-properties -- intentional skip when openssl is unavailable
const describeIfOpenssl = isOpensslAvailable() ? describe : describe.skip;

describeIfOpenssl('generateJwsToken', () => {
  let testCert: TestCert;

  beforeAll(() => {
    testCert = generateTestCert();
  });

  /** `jws.decode` returns `null | undefined` for invalid tokens; throw to keep test types simple. */
  function decodeOrThrow(token: string): jws.Signature {
    const decoded = jws.decode(token);
    if (!decoded) throw new Error('Could not decode JWS token');
    return decoded;
  }

  function makeToken(): string {
    return generateJwsToken({
      releaseRequest: { driEmail: ['dri@example.com'] },
      certificates: [testCert.leafCertPem],
      privateKey: testCert.keyPem,
    });
  }

  it('produces a JWS that verifies against the leaf cert public key', () => {
    const token = makeToken();
    expect(jws.verify(token, 'RS256', testCert.leafCertPem)).toBe(true);
  });

  it("includes the leaf cert's hex SHA1 thumbprint as x5t", () => {
    const decoded = decodeOrThrow(makeToken());
    expect((decoded.header as Record<string, unknown>).x5t).toBe(testCert.sha1ThumbprintHex);
  });

  it('includes the certificate chain as a "."-separated x5c (non-standard ESRP format)', () => {
    const decoded = decodeOrThrow(makeToken());
    const x5c = (decoded.header as Record<string, unknown>).x5c as string;
    expect(typeof x5c).toBe('string');
    // Single-cert chain so no separator should appear
    expect(x5c.includes('.')).toBe(false);
    // The base64url-decoded value matches the leaf cert DER
    const der = Buffer.from(x5c, 'base64url').toString('hex');
    const certDer = Buffer.from(
      testCert.leafCertPem.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\s+/g, ''),
      'base64'
    ).toString('hex');
    expect(der).toBe(certDer);
  });

  it('joins multi-certificate chains with "." in leaf-then-CA order', () => {
    const token = generateJwsToken({
      releaseRequest: { driEmail: ['test@example.com'] },
      certificates: [testCert.leafCertPem, testCert.caCertPem],
      privateKey: testCert.keyPem,
    });
    const decoded = decodeOrThrow(token);
    const x5c = (decoded.header as Record<string, unknown>).x5c as string;
    const parts = x5c.split('.');
    expect(parts).toHaveLength(2);

    const leafDer = Buffer.from(parts[0], 'base64url').toString('hex');
    const caDer = Buffer.from(parts[1], 'base64url').toString('hex');
    const expectedLeafDer = Buffer.from(
      testCert.leafCertPem.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\s+/g, ''),
      'base64'
    ).toString('hex');
    const expectedCaDer = Buffer.from(
      testCert.caCertPem.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\s+/g, ''),
      'base64'
    ).toString('hex');
    expect(leafDer).toBe(expectedLeafDer);
    expect(caDer).toBe(expectedCaDer);
  });

  it('sets exp using .NET ticks (greater than Date.now() in milliseconds)', () => {
    const now = Date.now();
    const decoded = decodeOrThrow(makeToken());
    const exp = (decoded.header as Record<string, unknown>).exp as number;
    // .NET ticks since 1/1/0001, which is far larger than any reasonable ms-since-epoch.
    expect(exp).toBeGreaterThan(now);
    expect(exp).toBeGreaterThan(621355968000000000);
  });

  it('serializes the release request as the JWS payload', () => {
    const releaseRequest = { driEmail: ['custom@test.com'] };
    const token = generateJwsToken({
      releaseRequest,
      certificates: [testCert.leafCertPem],
      privateKey: testCert.keyPem,
    });
    const decoded = decodeOrThrow(token);
    // jws decodes JSON payloads automatically when the header alg is RS256
    expect(JSON.parse(decoded.payload as string)).toEqual(releaseRequest);
  });
});
