import fs from 'fs';
import crypto from 'crypto';
import execa from 'execa';

/**
 * Hash a file using a stream (in case the file is large).
 */
export function hashFileStream(hashName: 'sha256', filePath: string): Promise<Buffer> {
  const stream = fs.createReadStream(filePath);
  return new Promise<Buffer>((resolve, reject) => {
    const shasum = crypto.createHash(hashName);

    stream
      .on('data', shasum.update.bind(shasum))
      .on('error', reject)
      .on('close', () => resolve(shasum.digest()));
  });
}

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
 * Certificates are returned with the end-entity (leaf) certificate first, followed by any
 * intermediates, with the root CA last. This reverses `openssl pkcs12`'s output order so
 * callers can index `[0]` to get the signing certificate.
 *
 * Throws an informative plain `Error` on any failure.
 */
export function getKeyAndCertificatesFromPFX(pfxContent: string): { key: string; certificates: string[] } {
  const pfxCertificate = Buffer.from(pfxContent, 'base64');
  let result: execa.ExecaSyncReturnValue;
  try {
    result = execa.sync('openssl', ['pkcs12', '-nodes', '-passin', 'pass:'], { input: pfxCertificate });
  } catch (_err) {
    const err = _err as execa.ExecaSyncError;
    throw new Error(`Error processing PFX with \`${err.command}\`:\n${err.message}`);
  }

  const keyMatch = result.stdout.match(/-----BEGIN PRIVATE KEY-----[\s\S]+?-----END PRIVATE KEY-----/);
  if (!keyMatch) {
    throw new Error('Private key not found in processed PFX');
  }

  const certMatches = result.stdout.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g);
  if (!certMatches) {
    throw new Error('Certificates not found in processed PFX');
  }

  return { key: keyMatch[0], certificates: certMatches.reverse() };
}
