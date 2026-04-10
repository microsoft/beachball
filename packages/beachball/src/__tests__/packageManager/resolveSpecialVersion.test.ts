import { describe, expect, it } from '@jest/globals';
import { resolveSpecialVersion } from '../../packageManager/resolveSpecialVersion';
import { makePackageInfos } from '../../__fixtures__/packageInfos';
import type { Catalogs } from 'workspace-tools';

describe('resolveSpecialVersion', () => {
  /** Package infos with just `foo@2.3.4` */
  const fooPackageInfos = makePackageInfos({
    foo: { version: '2.3.4' },
  });
  const emptyPackageInfos = makePackageInfos({});

  describe('regular versions', () => {
    it.each<[string, string]>([
      ['regular range', '^2.0.0'],
      ['exact version', '2.3.4'],
      ['npm dist tag', 'latest'],
    ])('returns undefined for %s', (_desc, depVersion) => {
      const result = resolveSpecialVersion({
        depName: 'foo',
        depVersion,
        catalogs: undefined,
        packageInfos: fooPackageInfos,
      });
      expect(result).toBeUndefined();
    });

    it('returns undefined for regular version of package not in repo', () => {
      const result = resolveSpecialVersion({
        depName: 'bar', // different package
        depVersion: '^1.0.0',
        catalogs: undefined,
        packageInfos: emptyPackageInfos,
      });
      expect(result).toBeUndefined();
    });
  });

  describe('workspace protocol', () => {
    it.each<[string, string]>([
      ['*', '2.3.4'], // * has a special meaning here as exact version
      ['^', '^2.3.4'],
      ['~', '~2.3.4'],
      // keeps specified full range
      ['^2.0.0', '^2.0.0'],
      ['>=1.0.0 <3.0.0', '>=1.0.0 <3.0.0'],
    ])('resolves workspace:%s', (workspaceRange, expected) => {
      const result = resolveSpecialVersion({
        depName: 'foo',
        depVersion: `workspace:${workspaceRange}`,
        catalogs: undefined,
        packageInfos: fooPackageInfos,
      });
      expect(result).toBe(expected);
    });

    it('throws if package not in workspace', () => {
      expect(() =>
        resolveSpecialVersion({
          depName: 'bar', // different package
          depVersion: 'workspace:*',
          catalogs: undefined,
          packageInfos: emptyPackageInfos,
        })
      ).toThrow(`Package "bar" (referenced by version "workspace:*") not found in workspace packages`);
    });
  });

  describe('catalog protocol', () => {
    const reactCatalogs: Catalogs = {
      default: { react: '^18.0.0' },
      named: {
        react17: { react: '^17.0.0' },
        react19: { react: '^19.0.0' },
      },
    };

    it('resolves catalog: to version from default catalog', () => {
      const result = resolveSpecialVersion({
        depName: 'react',
        depVersion: 'catalog:',
        catalogs: reactCatalogs,
        packageInfos: emptyPackageInfos,
      });
      expect(result).toBe('^18.0.0');
    });

    it('resolves catalog:name to version from named catalog', () => {
      const result = resolveSpecialVersion({
        depName: 'react',
        depVersion: 'catalog:react17',
        catalogs: reactCatalogs,
        packageInfos: emptyPackageInfos,
      });
      expect(result).toBe('^17.0.0');
    });

    // Verify empty catalogs are passed through to getCatalogVersion to throw the error
    it('throws if catalog version is specified and catalogs is undefined', () => {
      expect(() =>
        resolveSpecialVersion({
          depName: 'react',
          depVersion: 'catalog:',
          catalogs: undefined,
          packageInfos: emptyPackageInfos,
        })
      ).toThrow(`Dependency "react" uses a catalog version "catalog:" but no catalogs are defined.`);
    });

    // Error cases are covered in detail by the getCatalogVersion tests, so just test one case here
    it('throws if package not in catalog', () => {
      expect(() =>
        resolveSpecialVersion({
          depName: 'vue',
          depVersion: 'catalog:',
          catalogs: reactCatalogs,
          packageInfos: emptyPackageInfos,
        })
      ).toThrow(
        `Dependency "vue" uses a catalog version "catalog:", but the default catalog doesn't define a version for "vue".`
      );
    });
  });

  describe('catalog + workspace protocol combination', () => {
    it('resolves catalog: version pointing to workspace: version', () => {
      const result = resolveSpecialVersion({
        depName: 'foo',
        depVersion: 'catalog:',
        catalogs: { default: { foo: 'workspace:^' } },
        packageInfos: fooPackageInfos,
      });
      expect(result).toBe('^2.3.4');
    });

    it('throws on catalog: version pointing to workspace: version when package not in workspace', () => {
      expect(() =>
        resolveSpecialVersion({
          depName: 'foo',
          depVersion: 'catalog:',
          catalogs: { default: { foo: 'workspace:*' } },
          packageInfos: emptyPackageInfos,
        })
      ).toThrow(`Package "foo" (referenced by version "catalog:" -> "workspace:*") not found in workspace packages`);
    });
  });
});
