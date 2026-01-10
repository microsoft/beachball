/* eslint-disable @typescript-eslint/unbound-method */
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

  it('short circuits when no scope is provided', () => {
    const scopedPackages = getScopedPackages({ path: root }, packageInfos);
    expect(scopedPackages).toEqual(new Set(Object.keys(packageInfos)));

    // If all are in scope, the returned Set's `has` method is overridden to short circuit.
    expect(scopedPackages.has).not.toBe(Set.prototype.has);
    expect(scopedPackages.has('foo')).toBe(true);
    // But it still returns false if the package doesn't exist
    expect(scopedPackages.has('nonexistent')).toBe(false);
  });

  it('short circuits if all in scope', () => {
    const scopedPackages = getScopedPackages(
      {
        path: root,
        scope: ['packages/**/*'],
      },
      packageInfos
    );

    expect(scopedPackages).toEqual(new Set(Object.keys(packageInfos)));

    // If all are in scope, the returned Set's `has` method is overridden to short circuit.
    expect(scopedPackages.has).not.toBe(Set.prototype.has);
    expect(scopedPackages.has('foo')).toBe(true);
    // But it still returns false if the package doesn't exist
    expect(scopedPackages.has('nonexistent')).toBe(false);
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
    expect(scopedPackages.has).toBe(Set.prototype.has);
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
    expect(scopedPackages.has).toBe(Set.prototype.has);
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
    expect(scopedPackages.has).toBe(Set.prototype.has);
  });
});
