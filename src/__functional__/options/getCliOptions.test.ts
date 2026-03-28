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

  it('requires a command', () => {
    expect(() => getCliOptionsTest([])).toThrow();
  });

  it('parses command', () => {
    const options = getCliOptionsTest(['check']);
    expect(options).toEqual({ command: 'check', path: projectRoot });
  });

  it('parses options', () => {
    // use a basic option of each value type (except arrays, tested later)
    const options = getCliOptionsTest(['change', '--type', 'patch', '--access=public', '--fetch', '--depth', '1']);
    expect(options).toEqual({
      command: 'change',
      path: projectRoot,
      type: 'patch',
      access: 'public',
      fetch: true,
      depth: 1,
    });
  });

  it('parses command and options', () => {
    const options = getCliOptionsTest(['publish', '--tag', 'foo']);
    expect(options).toEqual({ command: 'publish', path: projectRoot, tag: 'foo' });
  });

  it('parses array options with multiple values', () => {
    const options = getCliOptionsTest(['change', '--scope', 'foo', 'bar']);
    expect(options).toEqual({ command: 'change', path: projectRoot, scope: ['foo', 'bar'] });
  });

  it('parses array option specified multiple times', () => {
    const options = getCliOptionsTest(['change', '--scope', 'foo', '--scope', 'bar']);
    expect(options).toEqual({ command: 'change', path: projectRoot, scope: ['foo', 'bar'] });
  });

  // documenting that this is not currently supported (could change in the future if desired)
  it('does not parse values with commas as separate array entries', () => {
    const options = getCliOptionsTest(['change', '--scope', 'a,b', '--scope=c,d']);
    expect(options).toEqual({ command: 'change', path: projectRoot, scope: ['a,b', 'c,d'] });
  });

  it('uses last value if non-array option is specified multiple times', () => {
    const options = getCliOptionsTest(['change', '--tag', 'foo', '--tag', 'baz']);
    expect(options).toEqual({ command: 'change', path: projectRoot, tag: 'baz' });
  });

  it('parses negated boolean option', () => {
    const options = getCliOptionsTest(['change', '--no-fetch']);
    expect(options).toEqual({ command: 'change', path: projectRoot, fetch: false });
  });

  it('parses negated boolean options with --no-X syntax', () => {
    const options = getCliOptionsTest(['change', '--no-fetch', '--no-yes']);
    expect(options).toEqual({ command: 'change', path: projectRoot, fetch: false, yes: false });
  });

  it('throws on invalid numeric value', () => {
    expect(() => getCliOptionsTest(['change', '--depth', 'foo'])).toThrow();
  });

  it('converts hyphenated options to camel case', () => {
    const options = getCliOptionsTest(['change', '--git-tags', '--dependent-change-type', 'patch']);
    expect(options).toEqual({
      command: 'change',
      path: projectRoot,
      gitTags: true,
      dependentChangeType: 'patch',
    });
  });

  it('requires hyphenated form for multi-word options', () => {
    const options = getCliOptionsTest([
      'change',
      '--git-tags',
      '--dependent-change-type',
      'patch',
      '--disallowed-change-types',
      'major',
      'minor',
    ]);
    expect(options).toEqual({
      command: 'change',
      path: projectRoot,
      gitTags: true,
      dependentChangeType: 'patch',
      disallowedChangeTypes: ['major', 'minor'],
    });
  });

  it('rejects camelCase form of multi-word options', () => {
    expect(() => getCliOptionsTest(['change', '--gitTags'])).toThrow();
    expect(() => getCliOptionsTest(['change', '--dependentChangeType', 'patch'])).toThrow();
    expect(() => getCliOptionsTest(['change', '--disallowedChangeTypes', 'major'])).toThrow();
  });

  it('suggests dashed form for camelCase boolean options', () => {
    expect(() => getCliOptionsTest(['change', '--gitTags'])).toThrow('Did you mean --git-tags or --no-git-tags?');
    expect(() => getCliOptionsTest(['change', '--bumpDeps'])).toThrow('Did you mean --bump-deps or --no-bump-deps?');
    expect(() => getCliOptionsTest(['change', '--keepChangeFiles'])).toThrow(
      'Did you mean --keep-change-files or --no-keep-change-files?'
    );
  });

  it('suggests dashed form for camelCase non-boolean options', () => {
    expect(() => getCliOptionsTest(['change', '--fromRef', 'main'])).toThrow('Did you mean --from-ref?');
    expect(() => getCliOptionsTest(['change', '--dependentChangeType', 'patch'])).toThrow(
      'Did you mean --dependent-change-type?'
    );
  });

  it('suggests dashed --no- form for camelCase --noX options', () => {
    expect(() => getCliOptionsTest(['change', '--noFetch'])).toThrow('Did you mean --fetch or --no-fetch?');
    expect(() => getCliOptionsTest(['change', '--noBump'])).toThrow('Did you mean --bump or --no-bump?');
    expect(() => getCliOptionsTest(['change', '--noGitTags'])).toThrow('Did you mean --git-tags or --no-git-tags?');
  });

  it('parses short option aliases', () => {
    const options = getCliOptionsTest(['publish', '-t', 'test', '-r', 'http://whatever', '-y']);
    expect(options).toEqual({
      command: 'publish',
      path: projectRoot,
      tag: 'test',
      registry: 'http://whatever',
      yes: true,
    });
  });

  it('parses long option aliases', () => {
    const options = getCliOptionsTest(['change', '--config', 'path/to/config.json', '--force', '--since', 'main']);
    expect(options).toEqual({
      command: 'change',
      path: projectRoot,
      configPath: 'path/to/config.json',
      forceVersions: true,
      fromRef: 'main',
    });
  });

  it('for canary command, adds canary tag and ignores regular tag', () => {
    const options = getCliOptionsTest(['canary', '--tag', 'bar']);
    expect(options).toEqual({ command: 'canary', path: projectRoot, tag: 'canary' });
  });

  it('for canary command, uses canaryName as tag and ignores regular tag', () => {
    const options = getCliOptionsTest(['canary', '--canary-name', 'foo', '--tag', 'bar']);
    expect(options).toEqual({ command: 'canary', path: projectRoot, canaryName: 'foo', tag: 'foo' });
  });

  it('does not set tag to canaryName for non-canary command', () => {
    const options = getCliOptionsTest(['publish', '--canary-name', 'foo', '--tag', 'bar']);
    expect(options).toEqual({ command: 'publish', path: projectRoot, canaryName: 'foo', tag: 'bar' });
  });

  it('falls back to given cwd as path if findProjectRoot fails', () => {
    mockFindProjectRoot.mockImplementationOnce(() => {
      throw new Error('nope');
    });
    const options = getCliOptionsTest(['change'], 'somewhere');
    expect(options).toEqual({ command: 'change', path: 'somewhere' });
  });

  it('uses provided branch if it contains a slash', () => {
    const options = getCliOptionsTest(['change', '--branch', 'someremote/foo']);
    expect(options).toEqual({ command: 'change', path: projectRoot, branch: 'someremote/foo' });
    // this is mocked at the top of the file
    // eslint-disable-next-line etc/no-deprecated
    expect(getDefaultRemoteBranch).not.toHaveBeenCalled();
  });

  it('adds default remote to branch without slash', () => {
    const options = getCliOptionsTest(['change', '--branch', 'foo']);
    expect(options).toEqual({ command: 'change', path: projectRoot, branch: 'origin/foo' });
    // eslint-disable-next-line etc/no-deprecated
    expect(getDefaultRemoteBranch).toHaveBeenCalledWith({ branch: 'foo', verbose: undefined, cwd: projectRoot });
  });

  it('throws on unknown string options', () => {
    expect(() => getCliOptionsTest(['change', '--foo', 'bar'])).toThrow();
  });

  it('throws on unknown boolean flags', () => {
    expect(() => getCliOptionsTest(['change', '--foo'])).toThrow();
  });

  it('throws on unknown negated boolean flags', () => {
    expect(() => getCliOptionsTest(['change', '--no-bar'])).toThrow();
  });

  it('throws on unknown option with value', () => {
    expect(() => getCliOptionsTest(['change', '--foo', 'true'])).toThrow();
  });

  it('throws on unknown option specified multiple times', () => {
    expect(() => getCliOptionsTest(['change', '--foo', 'bar', '--foo', 'baz'])).toThrow();
  });

  it('suggests --opt/--no-opt for near-match of a boolean flag', () => {
    expect(() => getCliOptionsTest(['change', '--fetc'])).toThrow('Did you mean --fetch or --no-fetch?');
    expect(() => getCliOptionsTest(['change', '--git-tag'])).toThrow('Did you mean --git-tags or --no-git-tags?');
    expect(() => getCliOptionsTest(['change', '--bum'])).toThrow('Did you mean --bump or --no-bump?');
  });

  it('suggests --opt/--no-opt for near-match of a --no-X flag', () => {
    expect(() => getCliOptionsTest(['change', '--no-git-tag'])).toThrow('Did you mean --git-tags or --no-git-tags?');
    expect(() => getCliOptionsTest(['change', '--no-bum'])).toThrow('Did you mean --bump or --no-bump?');
  });

  it('throws on unknown command', () => {
    expect(() => getCliOptionsTest(['unknown'])).toThrow();
  });

  it('throws on extra positional arguments', () => {
    expect(() => getCliOptionsTest(['check', 'extra'])).toThrow();
  });

  describe('config command', () => {
    it('parses config get with setting name', () => {
      const options = getCliOptionsTest(['config', 'get', 'branch']);
      expect(options).toEqual({ command: 'config get', path: projectRoot, configSettingName: 'branch' });
    });

    it('parses config get with setting name and options', () => {
      const options = getCliOptionsTest(['config', 'get', 'tag', '--package', 'my-pkg']);
      expect(options).toEqual({
        command: 'config get',
        path: projectRoot,
        configSettingName: 'tag',
        package: ['my-pkg'],
      });
    });

    it('parses config list', () => {
      const options = getCliOptionsTest(['config', 'list']);
      expect(options).toEqual({ command: 'config list', path: projectRoot });
    });

    it('throws on config get without setting name', () => {
      expect(() => getCliOptionsTest(['config', 'get'])).toThrow();
    });

    it('throws on config get with extra args', () => {
      expect(() => getCliOptionsTest(['config', 'get', 'branch', 'extra'])).toThrow();
    });
  });
});
