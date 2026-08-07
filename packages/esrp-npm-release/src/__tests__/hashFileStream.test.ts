import { beforeAll, describe, expect, it } from '@jest/globals';
import { setupTempDir } from '@microsoft/beachball-test-utilities';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { hashFileStream } from '../utils/hashFileStream.ts';

describe('hashFileStream', () => {
  const dir = setupTempDir({ cleanup: 'afterAll' });
  let tempDir: string;

  beforeAll(() => {
    tempDir = dir.getTempDir();
  });

  it('matches crypto.createHash on the same content', async () => {
    const content = Buffer.from('the quick brown fox jumps over the lazy dog\n');
    const file = path.join(tempDir, 'small.txt');
    fs.writeFileSync(file, content);

    const expected = crypto.createHash('sha256').update(content).digest();
    const actual = await hashFileStream('sha256', file);
    expect(actual.toString('hex')).toBe(expected.toString('hex'));
  });

  it('handles a larger file via streaming', async () => {
    const content = crypto.randomBytes(2 * 1024 * 1024); // 2 MiB
    const file = path.join(tempDir, 'big.bin');
    fs.writeFileSync(file, content);

    const expected = crypto.createHash('sha256').update(content).digest();
    const actual = await hashFileStream('sha256', file);
    expect(actual.toString('hex')).toBe(expected.toString('hex'));
  });
});
