import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import { getScopedPackages } from '../../monorepo/getScopedPackages';
import type { PackageInfos } from '../../types/PackageInfo';
import { getPackageInfos } from '../../monorepo/getPackageInfos';
import { createTestFileStructureType } from '../../__fixtures__/createTestFileStructure';
import { removeTempDir } from '../../__fixtures__/tmpdir';

describe('getScopedPackages', () => {
  let root: string;
  let packageInfos: PackageInfos;

  beforeAll(() => {
    root = createTestFileStructureType('monorepo');
    packageInfos = getPackageInfos({
      cliOptions: { path: root, command: '' },
      repoOptions: {},
    });
  });

  afterAll(() => {
    removeTempDir(root);
  });

  it('can scope packages', () => {
    const scopedPackages = getScopedPackages(
      {
        path: root,
        scope: ['packages/grouped/*'],
      },
      packageInfos
    );

    expect(scopedPackages).toEqual(['a', 'b']);
  });

  it('can scope with excluded packages', () => {
    const scopedPackages = getScopedPackages(
      {
        path: root,
        scope: ['!packages/grouped/*'],
      },
      packageInfos
    );

    expect(scopedPackages).toEqual(['bar', 'baz', 'foo']);
  });

  it('can mix and match with excluded packages', () => {
    const scopedPackages = getScopedPackages(
      {
        path: root,
        scope: ['packages/b*', '!packages/grouped/*'],
      },
      packageInfos
    );

    expect(scopedPackages).toEqual(['bar', 'baz']);
  });
});
