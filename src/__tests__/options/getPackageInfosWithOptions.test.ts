import { describe, expect, it } from '@jest/globals';
import { getPackageInfosWithOptions } from '../../options/getPackageInfosWithOptions';
import type { PackageInfo as WSPackageInfo } from 'workspace-tools';
import type { CliOptions, PackageOptions } from '../../types/BeachballOptions';
import { consideredDependencies, type PackageInfo } from '../../types/PackageInfo';

describe('getPackageInfosWithOptions', () => {
  const baseWsPackage: WSPackageInfo = {
    name: 'test-package',
    version: '1.0.0',
    packageJsonPath: '/fake/path/package.json',
    // extras not copied
    scripts: {},
    main: 'index.js',
    publishConfig: {},
  };
  const basePackageInfo: PackageInfo = {
    name: 'test-package',
    version: '1.0.0',
    packageJsonPath: '/fake/path/package.json',
  };

  describe('basic package info conversion', () => {
    it('handles empty package array', () => {
      const result = getPackageInfosWithOptions([], null);
      expect(result).toEqual({});
    });

    it('converts workspace-tools package to beachball format', () => {
      const result = getPackageInfosWithOptions([baseWsPackage], null);
      expect(result).toEqual({
        'test-package': basePackageInfo,
      });
    });

    it('preserves private flag when true', () => {
      const privatePackage = { ...baseWsPackage, private: true };
      const result = getPackageInfosWithOptions([privatePackage], null);
      expect(result).toEqual({
        'test-package': { ...basePackageInfo, private: true },
      });
    });

    it('omits private flag when false', () => {
      const privatePackage = { ...baseWsPackage, private: false };
      const result = getPackageInfosWithOptions([privatePackage], null);
      expect(result).toEqual({
        'test-package': basePackageInfo,
      });
    });

    it('handles multiple packages', () => {
      const wsPkgA: WSPackageInfo = { name: 'pkg-a', version: '1.0.0', packageJsonPath: '/path/a/package.json' };
      const wsPkgB: WSPackageInfo = { name: '@scope/b', version: '2.0.0', packageJsonPath: '/path/b/package.json' };
      const result = getPackageInfosWithOptions([wsPkgA, wsPkgB], null);
      expect(result).toEqual({
        'pkg-a': wsPkgA,
        '@scope/b': wsPkgB,
      });
    });
  });

  describe('dependency handling', () => {
    it('copies all dependency types when present', () => {
      const deps = {
        dependencies: { dep1: '^1.0.0', dep2: '~2.0.0' },
        devDependencies: { dep3: '^3.0.0' },
        peerDependencies: { dep4: '>=4.0.0' },
        optionalDependencies: { dep5: '^5.0.0' },
      };
      const result = getPackageInfosWithOptions([{ ...baseWsPackage, ...deps }], null);
      expect(result).toEqual({
        'test-package': { ...basePackageInfo, ...deps },
      });
    });

    // Setting undefined properties adds more noise and memory use
    it('does not set undefined properties for dep types not present', () => {
      const result = getPackageInfosWithOptions([baseWsPackage], null);
      for (const depType of consideredDependencies) {
        expect(result['test-package']).not.toHaveProperty(depType);
      }
    });
  });

  describe('combinedOptions property', () => {
    it('adds non-enumerable combinedOptions property', () => {
      const result = getPackageInfosWithOptions([baseWsPackage], null, true);
      const pkg = result['test-package'];

      // Should exist but not be enumerable
      // eslint-disable-next-line etc/no-deprecated
      expect(() => pkg.combinedOptions).toThrow('combinedOptions is no longer supported');
      expect(Object.keys(pkg)).not.toContain('combinedOptions');
      expect(JSON.stringify(pkg)).not.toContain('combinedOptions');
    });
  });

  describe('package-specific options', () => {
    it('includes packageOptions when beachball field is present', () => {
      const beachball: Required<PackageOptions> = {
        tag: 'beta',
        // ensure false, null, empty are preserved
        gitTags: false,
        disallowedChangeTypes: null,
        defaultNpmTag: '',
        shouldPublish: false,
      };

      const result = getPackageInfosWithOptions([{ ...baseWsPackage, beachball }], null);

      expect(result['test-package'].packageOptions).toEqual(beachball);
    });

    it('does not add packageOptions when beachball field is empty', () => {
      const result = getPackageInfosWithOptions([{ ...baseWsPackage, beachball: {} }], null);

      expect(result['test-package']).not.toHaveProperty('packageOptions' satisfies keyof PackageInfo);
    });
  });

  describe('CLI options overrides', () => {
    it('overrides package values with CLI values', () => {
      const beachball: PackageOptions = { tag: 'package-tag', gitTags: true, disallowedChangeTypes: ['minor'] };
      const cliOptions: Partial<CliOptions> = { tag: 'cli-tag', gitTags: false };

      const result = getPackageInfosWithOptions([{ ...baseWsPackage, beachball }], cliOptions);
      expect(result['test-package'].packageOptions).toEqual({
        tag: 'cli-tag',
        gitTags: false,
        disallowedChangeTypes: ['minor'],
      });
    });

    it('only includes package options that were set, even with CLI overrides', () => {
      const beachball: PackageOptions = { tag: 'beta' };
      const cliOptions: Partial<CliOptions> = { gitTags: false };
      const result = getPackageInfosWithOptions([{ ...baseWsPackage, beachball }], cliOptions);

      // gitTags CLI option should not appear because it wasn't in package options
      expect(result['test-package'].packageOptions).toEqual({ tag: 'beta' });
      expect(result['test-package'].packageOptions).not.toHaveProperty('gitTags');
    });
  });

  describe('integration scenarios', () => {
    it('handles real-world monorepo scenario', () => {
      const packages: WSPackageInfo[] = [
        {
          name: '@company/core',
          version: '2.0.0',
          packageJsonPath: '/monorepo/packages/core/package.json',
          dependencies: { lodash: '^4.17.0' },
          beachball: { tag: 'latest', gitTags: true },
        },
        {
          name: '@company/utils',
          version: '1.5.0',
          packageJsonPath: '/monorepo/packages/utils/package.json',
          dependencies: { '@company/core': '^2.0.0' },
          devDependencies: { jest: '^29.0.0' },
          beachball: { disallowedChangeTypes: ['major'] },
        },
        {
          name: '@company/internal',
          version: '0.1.0',
          packageJsonPath: '/monorepo/packages/internal/package.json',
          private: true,
          beachball: { shouldPublish: false },
        },
      ];

      const cliOptions: Partial<CliOptions> = { gitTags: false };
      const result = getPackageInfosWithOptions(packages, cliOptions);

      expect(result['@company/core'].packageOptions).toEqual({
        tag: 'latest',
        gitTags: false, // overridden by CLI
      });

      expect(result['@company/utils'].packageOptions).toEqual({
        disallowedChangeTypes: ['major'],
      });

      expect(result['@company/internal'].private).toBe(true);
      expect(result['@company/internal'].packageOptions).toEqual({
        shouldPublish: false,
      });
    });
  });
});
