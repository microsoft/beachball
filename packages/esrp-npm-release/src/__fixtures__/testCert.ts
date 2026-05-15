import execa from 'execa';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { removeTempDir } from './tempDir';

let opensslAvailableCache: boolean | undefined;

/**
 * Synchronously check whether `openssl` is available on PATH. The result is cached so the
 * subprocess is only spawned once per Jest worker.
 */
export function isOpensslAvailable(): boolean {
  if (opensslAvailableCache === undefined) {
    try {
      execa.sync('openssl', ['version']);
      opensslAvailableCache = true;
    } catch {
      opensslAvailableCache = false;
    }
  }
  return opensslAvailableCache;
}

export interface TestCert {
  /** PEM-encoded end-entity (leaf) certificate */
  leafCertPem: string;
  /** PEM-encoded CA certificate that signed the leaf */
  caCertPem: string;
  /** PEM-encoded private key (PKCS#8, unencrypted) for the leaf cert */
  keyPem: string;
  /**
   * Base64-encoded PFX bundle containing the leaf private key, leaf certificate, and CA
   * certificate. Suitable for passing to `getKeyAndCertificatesFromPFX`.
   */
  pfxBase64: string;
  /** Hex SHA1 thumbprint of the LEAF certificate, computed independently via openssl. */
  sha1ThumbprintHex: string;
  /** Hex SHA256 thumbprint of the LEAF certificate, computed independently via openssl. */
  sha256ThumbprintHex: string;
}

/**
 * Used for LOCAL TEST FIXTURES ONLY (not actual authentication).
 *
 * Generate a fresh test certificate chain (leaf signed by a CA), private key, and PFX bundle
 * synchronously via openssl. Use in a `beforeAll` after gating with `isOpensslAvailable()`.
 *
 * The PFX contains both the leaf and the CA certificate so tests can exercise the multi-cert
 * extraction path in `getKeyAndCertificatesFromPFX` (including its `.reverse()` ordering).
 *
 * Throws if openssl is not available; callers should skip the suite first.
 */
export function generateTestCert(): TestCert {
  if (!isOpensslAvailable()) {
    throw new Error('openssl is not available on PATH');
  }

  // this is removed at the end of the function
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'esrp-npm-release-test-cert-'));

  try {
    const caKeyPath = path.join(tempDir, 'ca-key.pem');
    const caCertPath = path.join(tempDir, 'ca-cert.pem');
    const leafKeyPath = path.join(tempDir, 'leaf-key.pem');
    const leafCsrPath = path.join(tempDir, 'leaf.csr');
    const leafCertPath = path.join(tempDir, 'leaf-cert.pem');
    const pfxPath = path.join(tempDir, 'chain.pfx');

    // 1. Generate the CA: self-signed cert + its private key.
    execa.sync('openssl', [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-keyout',
      caKeyPath,
      '-out',
      caCertPath,
      '-days',
      '1',
      '-subj',
      '/CN=esrp-npm-release-test-ca',
    ]);

    // 2. Generate the leaf private key + a CSR for it.
    execa.sync('openssl', [
      'req',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-keyout',
      leafKeyPath,
      '-out',
      leafCsrPath,
      '-subj',
      '/CN=esrp-npm-release-test-leaf',
    ]);

    // 3. Sign the leaf CSR with the CA to produce the leaf certificate.
    execa.sync('openssl', [
      'x509',
      '-req',
      '-in',
      leafCsrPath,
      '-CA',
      caCertPath,
      '-CAkey',
      caKeyPath,
      '-CAcreateserial',
      '-out',
      leafCertPath,
      '-days',
      '1',
    ]);

    // 4. Bundle leaf key + leaf cert + CA cert into a PFX (empty password matches the
    //    `getKeyAndCertificatesFromPFX` invocation).
    execa.sync('openssl', [
      'pkcs12',
      '-export',
      '-inkey',
      leafKeyPath,
      '-in',
      leafCertPath,
      '-certfile',
      caCertPath,
      '-out',
      pfxPath,
      '-password',
      'pass:',
    ]);

    const leafCertPem = fs.readFileSync(leafCertPath, 'utf8');
    const caCertPem = fs.readFileSync(caCertPath, 'utf8');
    const keyPem = fs.readFileSync(leafKeyPath, 'utf8');
    const pfxBase64 = fs.readFileSync(pfxPath).toString('base64');

    // Independently compute thumbprints of the leaf using openssl so tests don't rely on the
    // implementation under test for expected values. `openssl x509 -fingerprint` emits
    // "sha256 Fingerprint=AB:CD:..." — we strip the colons and lowercase to match `getThumbprint`.
    const sha1ThumbprintHex = computeFingerprint(leafCertPath, 'sha1');
    const sha256ThumbprintHex = computeFingerprint(leafCertPath, 'sha256');

    return { leafCertPem, caCertPem, keyPem, pfxBase64, sha1ThumbprintHex, sha256ThumbprintHex };
  } finally {
    removeTempDir(tempDir);
  }
}

function computeFingerprint(certPath: string, algorithm: 'sha1' | 'sha256'): string {
  const result = execa.sync('openssl', ['x509', '-in', certPath, '-noout', '-fingerprint', `-${algorithm}`]);
  // Output: "sha256 Fingerprint=AB:CD:..." — extract the hex part and strip colons
  const match = result.stdout.match(/Fingerprint=([A-F0-9:]+)/i);
  if (!match) {
    throw new Error(`Could not parse openssl fingerprint output: ${result.stdout}`);
  }
  return match[1].replace(/:/g, '').toLowerCase();
}
