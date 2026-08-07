import type { RepoOptions } from '../types/BeachballOptions';
import { createTestFileStructure } from '@microsoft/beachball-test-utilities';

/**
 * Create a test file structure for a named fixture (similar to the ones in `RepositoryFactory`).
 *
 * multi-project isn't supported since those scenarios tend to rely on git.
 */
export function createTestFileStructureType(
  type: 'single' | 'monorepo',
  beachballOptions?: Partial<RepoOptions>
): string {
  beachballOptions ??=
    type === 'single' ? {} : { groups: [{ disallowedChangeTypes: null, name: 'grouped', include: 'group*' }] };

  switch (type) {
    case 'single':
      return createTestFileStructure({
        'package.json': {
          name: 'foo',
          version: '1.0.0',
          dependencies: { bar: '1.0.0', baz: '1.0.0' },
          beachball: beachballOptions,
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
