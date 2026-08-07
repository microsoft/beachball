import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from './tmpdir.ts';

/**
 * For each key in `files`, create a test folder and write a file of that filePath, where the
 * content is the value (and create any intermediate folders).
 * @returns path to the test folder
 */
export function createTestFileStructure(
  files: Record<string, string | object>,
  options?: {
    /** Temp directory (will be created if not provided) */
    tempDir?: string;
  }
): string {
  const testFolderPath = options?.tempDir ?? tmpdir();

  for (const [filename, content] of Object.entries(files)) {
    const filePath = path.join(testFolderPath, filename);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, typeof content === 'string' ? content : JSON.stringify(content));
  }

  return testFolderPath;
}
