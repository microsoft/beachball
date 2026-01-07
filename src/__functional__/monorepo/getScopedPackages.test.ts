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
    packageInfos = getPackageInfos({ path: root, command: '' });
  });

  afterAll(() => {
    removeTempDir(root);
  });

  it('returns true when no scope is provided', () => {
    const scopedPackages = getScopedPackages({ path: root }, packageInfos);
    expect(scopedPackages).toEqual(new Set(Object.keys(packageInfos)));
    expect(scopedPackages.allInScope).toBe(true);
  });

  it('can scope packages', () => {
    const scopedPackages = getScopedPackages(
      {
        path: root,
        scope: ['packages/grouped/*'],
      },
      packageInfos
    );

    expect(scopedPackages).toEqual(new Set(['a', 'b']));
    expect(scopedPackages.allInScope).toBeUndefined();
  });

  it('can scope with excluded packages', () => {
    const scopedPackages = getScopedPackages(
      {
        path: root,
        scope: ['!packages/grouped/*'],
      },
      packageInfos
    );

    expect(scopedPackages).toEqual(new Set(['bar', 'baz', 'foo']));
    expect(scopedPackages.allInScope).toBeUndefined();
  });

  it('can mix and match with excluded packages', () => {
    const scopedPackages = getScopedPackages(
      {
        path: root,
        scope: ['packages/b*', '!packages/grouped/*'],
      },
      packageInfos
    );

    expect(scopedPackages).toEqual(new Set(['bar', 'baz']));
    expect(scopedPackages.allInScope).toBeUndefined();
  });
});
