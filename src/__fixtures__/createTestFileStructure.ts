import fs from 'fs-extra';
import { tmpdir } from './tmpdir';
import path from 'path';

/**
 * For each key in `files`, create a test folder and write a file of that filename, where the
 * content is the value (and create any intermediate folders).
 * @returns path to the test folder with **forward slashes**
 */
export function createTestFileStructure(files: Record<string, string | object>): string {
  const testFolderPath = tmpdir();

  for (const [filename, content] of Object.entries(files)) {
    const filePath = path.join(testFolderPath, filename);
    fs.ensureDirSync(path.dirname(filePath));
    fs.writeFileSync(filePath, typeof content === 'string' ? content : JSON.stringify(content));
  }

  return testFolderPath.replace(/\\/g, '/');
}
