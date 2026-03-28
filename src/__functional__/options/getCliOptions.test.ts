import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { getCliOptions } from '../../options/getCliOptions';
import { findProjectRoot, getDefaultRemoteBranch } from 'workspace-tools';

jest.mock('workspace-tools', () => {
  return {
    getDefaultRemoteBranch: jest.fn((options: { branch?: string }) => `origin/${options.branch || 'main'}`),
    findProjectRoot: jest.fn(() => 'fake-root'),
  };
});

//
// These tests cover a mix of built-in parser behavior, provided options, and custom overrides.
// The parser is commander, and these tests document the expected behavior from the beachball
// "end user" perspective.
//
describe('getCliOptions', () => {
  // This is the same mocked value as above (can't be shared in a const because jest.mock() is
  // not allowed to access the surrounding context)
  const projectRoot = 'fake-root';
  const mockFindProjectRoot = findProjectRoot as jest.MockedFunction<typeof findProjectRoot>;
  const defaults = { command: 'change', path: projectRoot };

  /** test wrapper for `getCliOptions` which adds common args */
  function getCliOptionsTest(args: string[], cwd?: string) {
    return getCliOptions({
      argv: ['node', 'beachball', ...args],
      cwd: cwd || projectRoot,
    });
  }

  afterEach(() => {
    jest.clearAllMocks();
  });

  // start by making sure nothing went wrong with the mock
  it('uses fake project root', () => {
    expect(findProjectRoot(process.cwd())).toEqual(projectRoot);
  });

  it('parses no args (adds path to result)', () => {
    const options = getCliOptionsTest([]);
    expect(options).toEqual(defaults);
  });

  it('parses command', () => {
    const options = getCliOptionsTest(['check']);
    expect(options).toEqual({ ...defaults, command: 'check' });
  });

  it('parses options', () => {
    // use a basic option of each value type (except arrays, tested later)
    const options = getCliOptionsTest(['--type', 'patch', '--access=public', '--fetch', '--depth', '1']);
    expect(options).toEqual({ ...defaults, type: 'patch', access: 'public', fetch: true, depth: 1 });
  });

  it('parses command and options', () => {
    const options = getCliOptionsTest(['publish', '--tag', 'foo']);
    expect(options).toEqual({ ...defaults, command: 'publish', tag: 'foo' });
  });

  it('parses array options with multiple values', () => {
    const options = getCliOptionsTest(['--scope', 'foo', 'bar']);
    expect(options).toEqual({ ...defaults, scope: ['foo', 'bar'] });
  });

  it('parses array option specified multiple times', () => {
    const options = getCliOptionsTest(['--scope', 'foo', '--scope', 'bar']);
    expect(options).toEqual({ ...defaults, scope: ['foo', 'bar'] });
  });

  // documenting that this is not currently supported (could change in the future if desired)
  it('does not parse values with commas as separate array entries', () => {
    const options = getCliOptionsTest(['--scope', 'a,b', '--scope=c,d']);
    expect(options).toEqual({ ...defaults, scope: ['a,b', 'c,d'] });
  });

  it('uses last value if non-array option is specified multiple times', () => {
    const options = getCliOptionsTest(['--tag', 'foo', '--tag', 'baz']);
    expect(options).toEqual({ ...defaults, tag: 'baz' });
  });

  it('parses negated boolean option', () => {
    const options = getCliOptionsTest(['--no-fetch']);
    expect(options).toEqual({ ...defaults, fetch: false });
  });

  it('parses negated boolean options with --no-X syntax', () => {
    const options = getCliOptionsTest(['--no-fetch', '--no-yes']);
    expect(options).toEqual({ ...defaults, fetch: false, yes: false });
  });

  it('throws on invalid numeric value', () => {
    expect(() => getCliOptionsTest(['--depth', 'foo'])).toThrow();
  });

  it('converts hyphenated options to camel case', () => {
    const options = getCliOptionsTest(['--git-tags', '--dependent-change-type', 'patch']);
    expect(options).toEqual({ ...defaults, gitTags: true, dependentChangeType: 'patch' });
  });

  it('requires hyphenated form for multi-word options', () => {
    const options = getCliOptionsTest([
      '--git-tags',
      '--dependent-change-type',
      'patch',
      '--disallowed-change-types',
      'major',
      'minor',
    ]);
    expect(options).toEqual({
      ...defaults,
      gitTags: true,
      dependentChangeType: 'patch',
      disallowedChangeTypes: ['major', 'minor'],
    });
  });

  it('rejects camelCase form of multi-word options', () => {
    expect(() => getCliOptionsTest(['--gitTags'])).toThrow();
    expect(() => getCliOptionsTest(['--dependentChangeType', 'patch'])).toThrow();
    expect(() => getCliOptionsTest(['--disallowedChangeTypes', 'major'])).toThrow();
  });

  it('suggests dashed form for camelCase boolean options', () => {
    expect(() => getCliOptionsTest(['--gitTags'])).toThrow('Did you mean --git-tags or --no-git-tags?');
    expect(() => getCliOptionsTest(['--bumpDeps'])).toThrow('Did you mean --bump-deps or --no-bump-deps?');
    expect(() => getCliOptionsTest(['--keepChangeFiles'])).toThrow(
      'Did you mean --keep-change-files or --no-keep-change-files?'
    );
  });

  it('suggests dashed form for camelCase non-boolean options', () => {
    expect(() => getCliOptionsTest(['--fromRef', 'main'])).toThrow('Did you mean --from-ref?');
    expect(() => getCliOptionsTest(['--dependentChangeType', 'patch'])).toThrow(
      'Did you mean --dependent-change-type?'
    );
  });

  it('suggests dashed --no- form for camelCase --noX options', () => {
    expect(() => getCliOptionsTest(['--noFetch'])).toThrow('Did you mean --fetch or --no-fetch?');
    expect(() => getCliOptionsTest(['--noBump'])).toThrow('Did you mean --bump or --no-bump?');
    expect(() => getCliOptionsTest(['--noGitTags'])).toThrow('Did you mean --git-tags or --no-git-tags?');
  });

  it('parses short option aliases', () => {
    const options = getCliOptionsTest(['publish', '-t', 'test', '-r', 'http://whatever', '-y']);
    expect(options).toEqual({ ...defaults, command: 'publish', tag: 'test', registry: 'http://whatever', yes: true });
  });

  it('parses long option aliases', () => {
    const options = getCliOptionsTest(['--config', 'path/to/config.json', '--force', '--since', 'main']);
    expect(options).toEqual({ ...defaults, configPath: 'path/to/config.json', forceVersions: true, fromRef: 'main' });
  });

  it('for canary command, adds canary tag and ignores regular tag', () => {
    const options = getCliOptionsTest(['canary', '--tag', 'bar']);
    expect(options).toEqual({ ...defaults, command: 'canary', tag: 'canary' });
  });

  it('for canary command, uses canaryName as tag and ignores regular tag', () => {
    const options = getCliOptionsTest(['canary', '--canary-name', 'foo', '--tag', 'bar']);
    expect(options).toEqual({ ...defaults, command: 'canary', canaryName: 'foo', tag: 'foo' });
  });

  it('does not set tag to canaryName for non-canary command', () => {
    const options = getCliOptionsTest(['publish', '--canary-name', 'foo', '--tag', 'bar']);
    expect(options).toEqual({ ...defaults, command: 'publish', canaryName: 'foo', tag: 'bar' });
  });

  it('falls back to given cwd as path if findProjectRoot fails', () => {
    mockFindProjectRoot.mockImplementationOnce(() => {
      throw new Error('nope');
    });
    const options = getCliOptionsTest([], 'somewhere');
    expect(options).toEqual({ ...defaults, path: 'somewhere' });
  });

  it('uses provided branch if it contains a slash', () => {
    const options = getCliOptionsTest(['--branch', 'someremote/foo']);
    expect(options).toEqual({ ...defaults, branch: 'someremote/foo' });
    // this is mocked at the top of the file
    // eslint-disable-next-line etc/no-deprecated
    expect(getDefaultRemoteBranch).not.toHaveBeenCalled();
  });

  it('adds default remote to branch without slash', () => {
    const options = getCliOptionsTest(['--branch', 'foo']);
    expect(options).toEqual({ ...defaults, branch: 'origin/foo' });
    // eslint-disable-next-line etc/no-deprecated
    expect(getDefaultRemoteBranch).toHaveBeenCalledWith({ branch: 'foo', verbose: undefined, cwd: projectRoot });
  });

  it('throws on unknown string options', () => {
    expect(() => getCliOptionsTest(['--foo', 'bar'])).toThrow();
  });

  it('throws on unknown boolean flags', () => {
    expect(() => getCliOptionsTest(['--foo'])).toThrow();
  });

  it('throws on unknown negated boolean flags', () => {
    expect(() => getCliOptionsTest(['--no-bar'])).toThrow();
  });

  it('throws on unknown option with value', () => {
    expect(() => getCliOptionsTest(['--foo', 'true'])).toThrow();
  });

  it('throws on unknown option specified multiple times', () => {
    expect(() => getCliOptionsTest(['--foo', 'bar', '--foo', 'baz'])).toThrow();
  });

  it('throws on unknown option followed by positional', () => {
    expect(() => getCliOptionsTest(['--foo', 'bar', 'baz'])).toThrow();
  });

  it('suggests --opt/--no-opt for near-match of a boolean flag', () => {
    expect(() => getCliOptionsTest(['--fetc'])).toThrow('Did you mean --fetch or --no-fetch?');
    expect(() => getCliOptionsTest(['--git-tag'])).toThrow('Did you mean --git-tags or --no-git-tags?');
    expect(() => getCliOptionsTest(['--bum'])).toThrow('Did you mean --bump or --no-bump?');
  });

  it('suggests --opt/--no-opt for near-match of a --no-X flag', () => {
    expect(() => getCliOptionsTest(['--no-git-tag'])).toThrow('Did you mean --git-tags or --no-git-tags?');
    expect(() => getCliOptionsTest(['--no-bum'])).toThrow('Did you mean --bump or --no-bump?');
  });

  describe('config command', () => {
    it('parses config get with setting name', () => {
      const options = getCliOptionsTest(['config', 'get', 'branch']);
      expect(options).toEqual({ ...defaults, command: 'config', _extraPositionalArgs: ['get', 'branch'] });
    });

    it('parses config get with setting name and options', () => {
      const options = getCliOptionsTest(['config', 'get', 'tag', '--package', 'my-pkg']);
      expect(options).toEqual({
        ...defaults,
        command: 'config',
        _extraPositionalArgs: ['get', 'tag'],
        package: ['my-pkg'],
      });
    });

    it('still throws for non-config command with extra positional args', () => {
      expect(() => getCliOptionsTest(['check', 'extra'])).toThrow(
        'Only one positional argument (the command) is allowed'
      );
    });
  });
});
