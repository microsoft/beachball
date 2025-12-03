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

/**
 * Create a test file structure for a named fixture (similar to the ones in `RepositoryFactory`).
 */
export function createTestFileStructureType(type: 'monorepo'): string {
  switch (type) {
    case 'monorepo':
      return createTestFileStructure({
        'package.json': {
          name: 'monorepo-fixture',
          version: '1.0.0',
          private: true,
          workspaces: ['packages/*', 'packages/grouped/*'],
        },
        'packages/foo/package.json': { name: 'foo', version: '1.0.0', dependencies: { bar: '^1.3.4' } },
        'packages/bar/package.json': { name: 'bar', version: '1.3.4', dependencies: { baz: '^1.3.4' } },
        'packages/baz/package.json': { name: 'baz', version: '1.3.4' },
        'packages/grouped/a/package.json': { name: 'a', version: '3.1.2' },
        'packages/grouped/b/package.json': { name: 'b', version: '3.1.2' },
        'yarn.lock': '',
      });
    default:
      throw new Error(`Unknown test file structure type: ${type}`);
  }
}
