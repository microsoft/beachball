import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import cp from 'child_process';
import os from 'os';

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

/** Get the thumbprint of a certificate with the specified algorithm */
export function getThumbprint(certPem: string, algorithm: 'sha1' | 'sha256'): Buffer {
  const certDer = pemToDer(certPem);
  return crypto.createHash(algorithm).update(certDer).digest();
}

export function getKeyFromPFX(pfxContent: string): string {
  const pfxCertificatePath = path.join(os.tmpdir(), 'cert.pfx');
  const pemKeyPath = path.join(os.tmpdir(), 'key.pem');

  try {
    const pfxCertificate = Buffer.from(pfxContent, 'base64');
    fs.writeFileSync(pfxCertificatePath, pfxCertificate);
    cp.execSync(`openssl pkcs12 -in "${pfxCertificatePath}" -nocerts -nodes -out "${pemKeyPath}" -passin pass:`);
    const raw = fs.readFileSync(pemKeyPath, 'utf-8');
    const result = raw.match(/-----BEGIN PRIVATE KEY-----[\s\S]+?-----END PRIVATE KEY-----/g);
    if (!result) {
      throw new Error('Failed to extract private key from PFX');
    }
    return result[0];
  } finally {
    fs.rmSync(pfxCertificatePath, { force: true });
    fs.rmSync(pemKeyPath, { force: true });
  }
}

export function getCertificatesFromPFX(pfxContent: string): string[] {
  const pfxCertificatePath = path.join(os.tmpdir(), 'cert.pfx');
  const pemCertificatePath = path.join(os.tmpdir(), 'cert.pem');

  try {
    const pfxCertificate = Buffer.from(pfxContent, 'base64');
    fs.writeFileSync(pfxCertificatePath, pfxCertificate);
    cp.execSync(`openssl pkcs12 -in "${pfxCertificatePath}" -nokeys -out "${pemCertificatePath}" -passin pass:`);
    const raw = fs.readFileSync(pemCertificatePath, 'utf-8');
    const matches = raw.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g);
    return matches ? matches.reverse() : [];
  } finally {
    fs.rmSync(pfxCertificatePath, { force: true });
    fs.rmSync(pemCertificatePath, { force: true });
  }
}

export function getCertificatesFromPemFile(pemFilePath: string): string[] {
  const certPem = fs.readFileSync(pemFilePath, 'utf-8');
  return certPem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) || [];
}
