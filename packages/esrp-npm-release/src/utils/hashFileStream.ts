import crypto from 'crypto';
import fs from 'fs';

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
      .on('end', () => resolve(shasum.digest()));
  });
}
