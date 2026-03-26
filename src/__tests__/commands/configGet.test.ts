import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { configGet } from '../../commands/configGet';
import type { BeachballOptions, ParsedOptions } from '../../types/BeachballOptions';
import { getDefaultOptions } from '../../options/getDefaultOptions';
import { initMockLogs } from '../../__fixtures__/mockLogs';

// Mock getPackageInfos to avoid needing a real git repo
jest.mock('../../monorepo/getPackageInfos', () => ({
  getPackageInfos: () => mockPackageInfos,
}));

let mockPackageInfos: Record<string, unknown> = {};

describe('configGet', () => {
  const logs = initMockLogs();

  function makeOptions(overrides: Partial<BeachballOptions> = {}): BeachballOptions {
    return { ...getDefaultOptions(), ...overrides };
  }

  function makeParsedOptions(overrides: Partial<BeachballOptions> = {}): ParsedOptions {
    const options = makeOptions(overrides);
    return { cliOptions: {}, options };
  }

  beforeEach(() => {
    mockPackageInfos = {};
  });

  it('displays a simple string config value', () => {
    const parsedOptions = makeParsedOptions({ branch: 'origin/main' });
    configGet(parsedOptions.options, 'branch', parsedOptions);
    expect(logs.getMockLines('log')).toBe('branch: origin/main');
  });

  it('displays a boolean config value', () => {
    const parsedOptions = makeParsedOptions({ bump: true });
    configGet(parsedOptions.options, 'bump', parsedOptions);
    expect(logs.getMockLines('log')).toBe('bump: true');
  });

  it('displays a null config value', () => {
    const parsedOptions = makeParsedOptions({ disallowedChangeTypes: null });
    configGet(parsedOptions.options, 'disallowedChangeTypes', parsedOptions);
    expect(logs.getMockLines('log')).toBe('disallowedChangeTypes: null');
  });

  it('displays an array config value', () => {
    const parsedOptions = makeParsedOptions({ disallowedChangeTypes: ['major'] });
    configGet(parsedOptions.options, 'disallowedChangeTypes', parsedOptions);
    expect(logs.getMockLines('log')).toBe('disallowedChangeTypes: ["major"]');
  });

  it('displays an empty string config value', () => {
    const parsedOptions = makeParsedOptions({ tag: '' });
    configGet(parsedOptions.options, 'tag', parsedOptions);
    expect(logs.getMockLines('log')).toBe('tag: ""');
  });

  it('throws on unknown config setting', () => {
    const parsedOptions = makeParsedOptions();
    expect(() => configGet(parsedOptions.options, 'nonExistent', parsedOptions)).toThrow();
    expect(logs.getMockLines('error')).toContain('Unknown config setting: "nonExistent"');
  });

  it('suggests similar config name on typo', () => {
    const parsedOptions = makeParsedOptions();
    expect(() => configGet(parsedOptions.options, 'branc', parsedOptions)).toThrow();
    expect(logs.getMockLines('error')).toContain('Did you mean "branch"');
  });

  it('shows package overrides for a package option', () => {
    mockPackageInfos = {
      'pkg-a': {
        name: 'pkg-a',
        version: '1.0.0',
        packageJsonPath: '/fake/pkg-a/package.json',
        packageOptions: { disallowedChangeTypes: ['major', 'minor'] },
      },
      'pkg-b': {
        name: 'pkg-b',
        version: '2.0.0',
        packageJsonPath: '/fake/pkg-b/package.json',
      },
    };

    const parsedOptions = makeParsedOptions({ disallowedChangeTypes: null });
    configGet(parsedOptions.options, 'disallowedChangeTypes', parsedOptions);

    const output = logs.getMockLines('log');
    expect(output).toContain('disallowedChangeTypes: null');
    expect(output).toContain('Packages with overrides:');
    expect(output).toContain('pkg-a: ["major","minor"]');
  });

  it('does not show package overrides section for non-package option', () => {
    mockPackageInfos = {
      'pkg-a': {
        name: 'pkg-a',
        version: '1.0.0',
        packageJsonPath: '/fake/pkg-a/package.json',
      },
    };

    const parsedOptions = makeParsedOptions({ branch: 'origin/main' });
    configGet(parsedOptions.options, 'branch', parsedOptions);

    const output = logs.getMockLines('log');
    expect(output).toBe('branch: origin/main');
    expect(output).not.toContain('Packages with overrides');
  });

  it('shows value for a specific package using --package', () => {
    mockPackageInfos = {
      'pkg-a': {
        name: 'pkg-a',
        version: '1.0.0',
        packageJsonPath: '/fake/pkg-a/package.json',
        packageOptions: { tag: 'beta' },
      },
    };

    const parsedOptions = makeParsedOptions({ package: 'pkg-a', tag: 'latest' });
    configGet(parsedOptions.options, 'tag', parsedOptions);

    const output = logs.getMockLines('log');
    expect(output).toContain('tag (for pkg-a): beta');
  });

  it('falls back to repo value when package has no override', () => {
    mockPackageInfos = {
      'pkg-a': {
        name: 'pkg-a',
        version: '1.0.0',
        packageJsonPath: '/fake/pkg-a/package.json',
      },
    };

    const parsedOptions = makeParsedOptions({ package: 'pkg-a', tag: 'latest' });
    configGet(parsedOptions.options, 'tag', parsedOptions);

    const output = logs.getMockLines('log');
    expect(output).toContain('tag (for pkg-a): latest');
  });

  it('shows values for multiple packages', () => {
    mockPackageInfos = {
      'pkg-a': {
        name: 'pkg-a',
        version: '1.0.0',
        packageJsonPath: '/fake/pkg-a/package.json',
        packageOptions: { tag: 'beta' },
      },
      'pkg-b': {
        name: 'pkg-b',
        version: '2.0.0',
        packageJsonPath: '/fake/pkg-b/package.json',
        packageOptions: { tag: 'next' },
      },
    };

    const parsedOptions = makeParsedOptions({ package: ['pkg-a', 'pkg-b'], tag: 'latest' });
    configGet(parsedOptions.options, 'tag', parsedOptions);

    const output = logs.getMockLines('log');
    expect(output).toContain('tag (for pkg-a): beta');
    expect(output).toContain('tag (for pkg-b): next');
  });

  it('throws when a requested package is not found', () => {
    mockPackageInfos = {};

    const parsedOptions = makeParsedOptions({ package: 'nonexistent' });
    expect(() => configGet(parsedOptions.options, 'branch', parsedOptions)).toThrow();
    expect(logs.getMockLines('error')).toContain('Package not found: "nonexistent"');
  });

  it('shows group overrides for disallowedChangeTypes', () => {
    const parsedOptions = makeParsedOptions({
      disallowedChangeTypes: null,
      groups: [
        {
          name: 'my-group',
          include: 'packages/*',
          disallowedChangeTypes: ['major'],
        },
      ],
    });
    configGet(parsedOptions.options, 'disallowedChangeTypes', parsedOptions);

    const output = logs.getMockLines('log');
    expect(output).toContain('disallowedChangeTypes: null');
    expect(output).toContain('Group overrides:');
    expect(output).toContain('my-group: ["major"]');
  });

  it('does not show group overrides for non-disallowedChangeTypes options', () => {
    const parsedOptions = makeParsedOptions({
      tag: 'latest',
      groups: [
        {
          name: 'my-group',
          include: 'packages/*',
          disallowedChangeTypes: ['major'],
        },
      ],
    });
    configGet(parsedOptions.options, 'tag', parsedOptions);

    const output = logs.getMockLines('log');
    expect(output).toBe('tag: latest');
    expect(output).not.toContain('Group overrides');
  });

  it('handles function values (hooks)', () => {
    const parsedOptions = makeParsedOptions({
      hooks: { prepublish: () => {} },
    });
    configGet(parsedOptions.options, 'hooks', parsedOptions);

    // hooks is an object, but its value contains functions - it will be JSON serialized
    // (functions become undefined in JSON.stringify, so just verify it doesn't throw)
    expect(logs.getMockLines('log')).toContain('hooks:');
  });
});
