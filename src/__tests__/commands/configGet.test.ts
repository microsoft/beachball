import { describe, expect, it } from '@jest/globals';
import { expectBeachballError } from '../../__fixtures__/expectBeachballError';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { makePackageInfos, type PartialPackageInfos } from '../../__fixtures__/packageInfos';
import { configGet } from '../../commands/configGet';
import { getPackageGroups } from '../../monorepo/getPackageGroups';
import { getDefaultOptions } from '../../options/getDefaultOptions';
import { BeachballError } from '../../types/BeachballError';
import type { BeachballOptions, PackageOptions, VersionGroupOptions } from '../../types/BeachballOptions';

describe('configGet', () => {
  const logs = initMockLogs();

  /** Wrapper that just provides custom args to `configGet` (for invalid argument cases) */
  function configGetArgs(args: string[]) {
    configGet(
      { ...getDefaultOptions(), _extraPositionalArgs: args },
      { originalPackageInfos: {}, scopedPackages: new Set(), packageGroups: {} }
    );
  }

  /** Get the given option (`name` will be formatted as args) with optional overrides */
  function configGetWrapper(
    name: string,
    params: {
      packageInfos?: PartialPackageInfos;
      options?: Partial<BeachballOptions>;
      scopedPackages?: Set<string>;
    }
  ) {
    const { options: optionOverrides, packageInfos = {}, scopedPackages } = params;

    const options: BeachballOptions = {
      ...getDefaultOptions(),
      _extraPositionalArgs: ['get', name],
      ...optionOverrides,
    };
    const originalPackageInfos = makePackageInfos(packageInfos);

    configGet(options, {
      originalPackageInfos,
      packageGroups: getPackageGroups(originalPackageInfos, '', options.groups),
      scopedPackages: scopedPackages || new Set(Object.keys(originalPackageInfos)),
    });
  }

  describe('argument validation', () => {
    it('throws on missing subcommand', async () => {
      await expectBeachballError(() => configGetArgs([]), 'Usage: beachball config get <setting>');
    });

    it('throws on wrong subcommand', async () => {
      await expectBeachballError(() => configGetArgs(['set', 'branch']), 'Usage: beachball config get <setting>');
    });

    it('throws on too many args', async () => {
      await expectBeachballError(
        () => configGetArgs(['get', 'branch', 'extra']),
        'Usage: beachball config get <setting>'
      );
    });

    it('throws on unknown config setting', async () => {
      await expectBeachballError(() => configGetArgs(['get', 'nonExistent']), 'Unknown config setting: "nonExistent"');
    });

    it('suggests similar config name on typo', async () => {
      await expectBeachballError(
        () => configGetArgs(['get', 'branc']),
        'Unknown config setting: "branc" - did you mean "branch"?'
      );
    });
  });

  describe('basic values', () => {
    it('displays a simple string config value', () => {
      configGetWrapper('branch', { options: { branch: 'origin/main' } });
      expect(logs.getMockLines('log')).toBe('"origin/main"');
    });

    it('displays a boolean config value', () => {
      configGetWrapper('bump', { options: { bump: true } });
      expect(logs.getMockLines('log')).toBe('true');
    });

    it('displays a null config value', () => {
      configGetWrapper('disallowedChangeTypes', { options: { disallowedChangeTypes: null } });
      expect(logs.getMockLines('log')).toBe('null');
    });

    it('displays a short array config value', () => {
      configGetWrapper('disallowedChangeTypes', { options: { disallowedChangeTypes: ['major'] } });
      expect(logs.getMockLines('log')).toBe('["major"]');
    });

    it('displays an empty string config value', () => {
      configGetWrapper('tag', { options: { tag: '' } });
      expect(logs.getMockLines('log')).toBe('""');
    });
  });

  describe('packageOptions overrides', () => {
    it('shows package overrides for a package option', () => {
      configGetWrapper('disallowedChangeTypes', {
        options: { disallowedChangeTypes: null },
        packageInfos: {
          'pkg-a': { beachball: { disallowedChangeTypes: ['major', 'minor'] } },
          'pkg-b': { version: '2.0.0' },
        },
      });

      const output = logs.getMockLines('log');
      expect(output).toMatchInlineSnapshot(`
        "Main value: null

        Package overrides:
          pkg-a: ["major", "minor"]"
      `);
    });

    it('does not show package overrides section for non-package option', () => {
      configGetWrapper('branch', {
        options: { branch: 'origin/main' },
        packageInfos: {
          'pkg-a': {},
          'pkg-b': { beachball: { branch: 'ignored' } as PackageOptions },
        },
      });

      const output = logs.getMockLines('log');
      // Does not contain "Packages with overrides"
      expect(output).toBe('"origin/main"');
    });
  });

  describe('--package option', () => {
    it('shows value for a specific package using --package', () => {
      configGetWrapper('tag', {
        options: { package: 'pkg-a', tag: 'latest' },
        packageInfos: {
          'pkg-a': { beachball: { tag: 'beta' } },
          'pkg-b': { beachball: { tag: 'next' } },
          'pkg-c': {},
        },
      });

      const output = logs.getMockLines('log');
      expect(output).toBe('pkg-a: "beta"');
    });

    it('falls back to repo value when --package has no override', () => {
      configGetWrapper('tag', {
        options: { package: 'pkg-a', tag: 'latest' },
        packageInfos: { 'pkg-a': {} },
      });

      const output = logs.getMockLines('log');
      expect(output).toBe('pkg-a: "latest"');
    });

    it('shows values for multiple packages using --package', () => {
      configGetWrapper('tag', {
        options: { package: ['pkg-a', 'pkg-b'], tag: 'latest' },
        packageInfos: {
          'pkg-a': { beachball: { tag: 'beta' } },
          'pkg-b': { version: '2.0.0', beachball: { tag: 'next' } },
        },
      });

      const output = logs.getMockLines('log');
      expect(output).toMatchInlineSnapshot(`
        "pkg-a: "beta"
        pkg-b: "next""
      `);
    });

    it('throws when a requested package is not found', () => {
      expect(() => configGetWrapper('branch', { options: { package: 'nonexistent' } })).toThrow(BeachballError);
      expect(logs.getMockLines('error')).toBe('Package "nonexistent" not found in repo');
    });

    it('throws when a requested package is not included', () => {
      expect(() =>
        configGetWrapper('branch', {
          options: { package: 'pkg-a' },
          packageInfos: { 'pkg-a': { private: true } },
        })
      ).toThrow(BeachballError);
      expect(logs.getMockLines('error')).toBe('Invalid package: pkg-a is private');
    });
  });

  describe('group overrides', () => {
    it('shows group overrides for disallowedChangeTypes', () => {
      configGetWrapper('disallowedChangeTypes', {
        options: {
          disallowedChangeTypes: null,
          groups: [{ name: 'my-group', include: 'packages/*', disallowedChangeTypes: ['major'] }],
        },
        packageInfos: { 'pkg-a': {}, 'pkg-b': {} },
      });

      const output = logs.getMockLines('log');
      expect(output).toMatchInlineSnapshot(`
        "Main value: null

        Group overrides:
          my-group:
            disallowedChangeTypes: ["major"]
            packageNames: ["pkg-a", "pkg-b"]"
      `);
    });

    // validate() will fail in this situation, but still verify the precedence
    it('prefers group disallowedChangeTypes over package disallowedChangeTypes with --package', () => {
      configGetWrapper('disallowedChangeTypes', {
        options: {
          package: 'pkg-a',
          disallowedChangeTypes: null,
          groups: [{ name: 'my-group', include: 'packages/*', disallowedChangeTypes: ['major'] }],
        },
        packageInfos: {
          'pkg-a': { beachball: { disallowedChangeTypes: ['minor'] } },
        },
      });

      // Group value ['major'] wins over package value ['minor']
      expect(logs.getMockLines('log')).toBe('pkg-a: ["major"]');
    });

    it('does not show group overrides for invalid group options', () => {
      configGetWrapper('tag', {
        options: {
          tag: 'latest',
          groups: [{ name: 'my-group', include: 'packages/*', tag: 'ignored' } as unknown as VersionGroupOptions],
        },
        packageInfos: {},
      });

      const output = logs.getMockLines('log');
      // does not contain "Group overrides" because "tag" isn't valid for groups
      expect(output).toBe('"latest"');
    });

    it('handles function values (hooks)', () => {
      configGetWrapper('hooks', {
        options: { hooks: { prepublish: () => {}, postpublish: () => {} } },
        packageInfos: {},
      });

      // functions get formatted as (Function)
      expect(logs.getMockLines('log')).toMatchInlineSnapshot(`
              "prepublish: (Function)
              postpublish: (Function)"
          `);
    });
  });
});
