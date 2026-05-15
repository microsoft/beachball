import { beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { getKeyAndCertificatesFromPFX, getThumbprint, pemToDer } from '../utils/signing.ts';
import { MockLogger } from '../__fixtures__/MockLogger.ts';
import { generateTestCert, isOpensslAvailable, type TestCert } from '../__fixtures__/testCert.ts';

// eslint-disable-next-line no-restricted-properties -- intentional skip when openssl is unavailable
const describeIfOpenssl = isOpensslAvailable() ? describe : describe.skip;

describeIfOpenssl('signing utilities (openssl-based)', () => {
  let testCert: TestCert;
  let logger: MockLogger;

  beforeAll(() => {
    testCert = generateTestCert();
  });

  beforeEach(() => {
    logger = new MockLogger();
  });

  describe('getKeyAndCertificatesFromPFX', () => {
    it('extracts the private key and the full certificate chain from a valid PFX', () => {
      const { key, certificates } = getKeyAndCertificatesFromPFX(testCert.pfxBase64, logger);

      expect(key).toMatch(/^-----BEGIN PRIVATE KEY-----[\s\S]+-----END PRIVATE KEY-----$/);
      expect(certificates).toEqual([
        expect.stringMatching(/^-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----$/),
        expect.stringMatching(/^-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----$/),
      ]);
    });

    it('returns certificates with the leaf (key-matching) cert at index 0, regardless of openssl output order', () => {
      const { certificates } = getKeyAndCertificatesFromPFX(testCert.pfxBase64, logger);
      expect(certificates).toHaveLength(2);
      expect(pemToDer(certificates[0]).toString('hex')).toBe(pemToDer(testCert.leafCertPem).toString('hex'));
      expect(pemToDer(certificates[1]).toString('hex')).toBe(pemToDer(testCert.caCertPem).toString('hex'));
    });

    it('logs which position the leaf was found at', () => {
      getKeyAndCertificatesFromPFX(testCert.pfxBase64, logger);

      // Exactly one log line should report the leaf position
      const positionLines = logger.lines.filter(l => l.includes('leaf is at'));
      expect(positionLines).toHaveLength(1);
      // Whichever position openssl emits the leaf at on this platform, it should be either
      // "index 0 (using as-is)" or "last index (reversing)"
      expect(positionLines[0]).toMatch(/leaf is at (index 0|last index)/);
      expect(positionLines[0]).toContain('Found 2 certificate(s) in PFX');
    });

    it('throws an informative error when the input is not valid base64 PFX content', () => {
      expect(() => getKeyAndCertificatesFromPFX('not-a-real-pfx', logger)).toThrow(
        'Error processing PFX with `openssl'
      );
    });
  });

  describe('pemToDer', () => {
    it('round-trips through openssl: re-encoding the DER as PEM matches the original', () => {
      const der = pemToDer(testCert.leafCertPem);
      // Compare DER lengths and hex content
      expect(der.length).toBeGreaterThan(100); // a 2048-bit RSA cert is well over 100 bytes
      expect(der.toString('base64')).toBe(
        testCert.leafCertPem.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\s+/g, '')
      );
    });
  });

  describe('getThumbprint', () => {
    it('produces a SHA1 thumbprint matching openssl x509 -fingerprint -sha1', () => {
      expect(getThumbprint(testCert.leafCertPem, 'sha1').toString('hex')).toBe(testCert.sha1ThumbprintHex);
    });

    it('produces a SHA256 thumbprint matching openssl x509 -fingerprint -sha256', () => {
      expect(getThumbprint(testCert.leafCertPem, 'sha256').toString('hex')).toBe(testCert.sha256ThumbprintHex);
    });
  });
});
