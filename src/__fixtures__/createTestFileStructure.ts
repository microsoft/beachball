import fs from 'fs';
import { tmpdir } from './tmpdir';
import path from 'path';
import type { RepoOptions } from '../types/BeachballOptions';

/**
 * For each key in `files`, create a test folder and write a file of that filename, where the
 * content is the value (and create any intermediate folders).
 * @returns path to the test folder with **forward slashes**
 */
export function createTestFileStructure(files: Record<string, string | object>): string {
  const testFolderPath = tmpdir();

  for (const [filename, content] of Object.entries(files)) {
    const filePath = path.join(testFolderPath, filename);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, typeof content === 'string' ? content : JSON.stringify(content));
  }

  return testFolderPath.replace(/\\/g, '/');
}

/**
 * Create a test file structure for a named fixture (similar to the ones in `RepositoryFactory`).
 *
 * multi-project isn't supported since those scenarios tend to rely on git.
 */
export function createTestFileStructureType(type: 'single' | 'monorepo'): string {
  const beachballOptions: Partial<RepoOptions> = {
    groups: [{ disallowedChangeTypes: null, name: 'grouped', include: 'group*' }],
  };

  switch (type) {
    case 'single':
      return createTestFileStructure({
        'package.json': {
          name: 'foo',
          version: '1.0.0',
          dependencies: { bar: '1.0.0', baz: '1.0.0' },
        },
      });
    case 'monorepo':
      return createTestFileStructure({
        'package.json': {
          name: 'monorepo-fixture',
          version: '1.0.0',
          private: true,
          workspaces: ['packages/*', 'packages/grouped/*'],
          beachball: beachballOptions,
        },
        'packages/foo/package.json': { name: 'foo', version: '1.0.0', dependencies: { bar: '^1.3.4' } },
        'packages/bar/package.json': { name: 'bar', version: '1.3.4', dependencies: { baz: '^1.3.4' } },
        'packages/baz/package.json': { name: 'baz', version: '1.3.4' },
        'packages/grouped/a/package.json': { name: 'a', version: '3.1.2' },
        'packages/grouped/b/package.json': { name: 'b', version: '3.1.2' },
        'yarn.lock': '',
      });
  }
}
