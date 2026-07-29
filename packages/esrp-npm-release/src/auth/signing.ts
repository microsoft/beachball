import crypto from 'crypto';
import spawn, { type Result as SpawnResult, type SubprocessError } from 'nano-spawn';
import type { Logger } from '../utils/Logger.ts';

/**
 * Convert a certificate from PEM format (base64 text with header/footer) into the raw
 * DER binary format.
 */
export function pemToDer(input: string): Buffer {
  return Buffer.from(input.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\s+/g, ''), 'base64');
}

/**
 * Get the thumbprint of a certificate with the specified algorithm.
 */
export function getThumbprint(certPem: string, algorithm: 'sha1' | 'sha256'): Buffer {
  const certDer = pemToDer(certPem);
  return crypto.createHash(algorithm).update(certDer).digest();
}

/**
 * Extract the private key and all certificates from a PFX file using `openssl`.
 *
 * Returns `certificates` with the end-entity (leaf) certificate at index 0, identified by
 * matching its public key against the extracted private key. The leaf is expected to be
 * either the first or last cert that `openssl pkcs12` emits — which covers every realistic
 * PFX producer (openssl, Windows certutil/`Export-PfxCertificate`, browsers, keytool, etc.).
 * If neither the first nor last cert matches the key, this throws rather than guess.
 *
 * Throws an informative plain `Error` on any failure.
 */
export async function getKeyAndCertificatesFromPFX(
  pfxContent: string,
  logger: Logger
): Promise<{ key: string; certificates: string[] }> {
  const pfxCertificate = Buffer.from(pfxContent, 'base64');
  let result: SpawnResult;
  try {
    const subprocess = spawn('openssl', ['pkcs12', '-nodes', '-passin', 'pass:']);
    // nano-spawn's `{ string }` stdin option writes as utf8 and can't carry binary data
    // losslessly, so write the raw PFX bytes straight to the child's stdin stream instead.
    const child = await subprocess.nodeChildProcess;
    child.stdin?.end(pfxCertificate);
    result = await subprocess;
  } catch (_err) {
    const err = _err as SubprocessError;
    throw new Error(`Error processing PFX with \`${err.command}\`:\n${err.stderr}`, { cause: _err });
  }

  const key = result.stdout.match(/-----BEGIN PRIVATE KEY-----[\s\S]+?-----END PRIVATE KEY-----/)?.[0];
  if (!key) {
    throw new Error('Private key not found in processed PFX');
  }

  const certMatches = result.stdout.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g);
  if (!certMatches) {
    throw new Error('Certificates not found in processed PFX');
  }

  // Identify the leaf cert by matching its public key against the private key. We only
  // check the first and last positions since real-world PFX producers all put the leaf at
  // one end or the other.
  const keyPub = crypto.createPublicKey(key).export({ type: 'spki', format: 'der' });
  const matchesKey = (cert: string) =>
    crypto.createPublicKey(cert).export({ type: 'spki', format: 'der' }).equals(keyPub);

  let certificates: string[];
  if (matchesKey(certMatches[0])) {
    logger.log(`Found ${certMatches.length} certificate(s) in PFX; leaf is at index 0 (using as-is)`);
    certificates = certMatches;
  } else if (matchesKey(certMatches[certMatches.length - 1])) {
    logger.log(`Found ${certMatches.length} certificate(s) in PFX; leaf is at last index (reversing)`);
    certificates = [...certMatches].reverse();
  } else {
    throw new Error('Leaf certificate (matching the private key) is neither first nor last in the PFX');
  }

  return { key, certificates };
}
