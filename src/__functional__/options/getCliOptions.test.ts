import { afterAll, afterEach, describe, expect, it, jest } from '@jest/globals';
import { getCliOptions } from '../../options/getCliOptions';
import { findProjectRoot, getDefaultRemoteBranch } from 'workspace-tools';

jest.mock('workspace-tools', () => {
  return {
    getDefaultRemoteBranch: jest.fn((options: { branch?: string }) => `origin/${options.branch || 'main'}`),
    findProjectRoot: jest.fn(() => 'fake-root'),
  };
});

/** test wrapper for `getCliOptions` which adds common args */
function getCliOptionsTest(args: string[]) {
  return getCliOptions(['node', 'beachball', ...args], true /*disableCache*/);
}

//
// These tests cover a mix of built-in parser behavior, provided options, and custom overrides.
// It's worth having tests for relevant built-in behaviors in case we change parsers in the future
// (likely to commander), to ensure there are no undocumented breaking changes from the beachball
// "end user" perspective.
//
describe('getCliOptions', () => {
  // This is the same mocked value as above (can't be shared in a const because jest.mock() is
  // not allowed to access the surrounding context)
  const projectRoot = 'fake-root';
  const mockFindProjectRoot = findProjectRoot as jest.MockedFunction<typeof findProjectRoot>;
  const defaults = { command: 'change', path: projectRoot };

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
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

  it('throws if non-array option is specified multiple times', () => {
    expect(() => getCliOptionsTest(['--tag', 'foo', '--tag', 'baz'])).toThrow();
  });

  it('parses negated boolean option', () => {
    const options = getCliOptionsTest(['--no-fetch']);
    expect(options).toEqual({ ...defaults, fetch: false });
  });

  it('parses valid boolean option values', () => {
    const falseOptions = getCliOptionsTest(['--fetch=false', '--yes', 'false']);
    expect(falseOptions).toEqual({ ...defaults, fetch: false, yes: false });

    const trueOptions = getCliOptionsTest(['--fetch=true', '--yes', 'true']);
    expect(trueOptions).toEqual({ ...defaults, fetch: true, yes: true });
  });

  it('parses boolean flag with valid value', () => {
    const falseOptions = getCliOptionsTest(['-y', 'false']);
    expect(falseOptions).toEqual({ ...defaults, yes: false });

    const trueOptions = getCliOptionsTest(['-y', 'true']);
    expect(trueOptions).toEqual({ ...defaults, yes: true });
  });

  it('throws on invalid numeric value', () => {
    expect(() => getCliOptionsTest(['--depth', 'foo'])).toThrow();
  });

  it('converts hyphenated options to camel case', () => {
    const options = getCliOptionsTest(['--git-tags', '--dependent-change-type', 'patch']);
    expect(options).toEqual({ ...defaults, gitTags: true, dependentChangeType: 'patch' });
  });

  it('supports camel case for options defined as hyphenated', () => {
    const options = getCliOptionsTest([
      '--gitTags',
      '--dependentChangeType',
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

  it('falls back to process.cwd as path if findProjectRoot fails', () => {
    mockFindProjectRoot.mockImplementationOnce(() => {
      throw new Error('nope');
    });
    const options = getCliOptionsTest([]);
    expect(options).toEqual({ ...defaults, path: process.cwd() });
  });

  it('uses provided branch if it contains a slash', () => {
    const options = getCliOptionsTest(['--branch', 'someremote/foo']);
    expect(options).toEqual({ ...defaults, branch: 'someremote/foo' });
    // this is mocked at the top of the file
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- incorrect flag of variadic signature
    expect(getDefaultRemoteBranch).not.toHaveBeenCalled();
  });

  it('adds default remote to branch without slash', () => {
    const options = getCliOptionsTest(['--branch', 'foo']);
    expect(options).toEqual({ ...defaults, branch: 'origin/foo' });
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- incorrect flag of variadic signature
    expect(getDefaultRemoteBranch).toHaveBeenCalledWith({ branch: 'foo', verbose: undefined, cwd: projectRoot });
  });

  it('preserves additional string options', () => {
    const options = getCliOptionsTest(['--foo', 'bar', '--baz=qux']);
    expect(options).toEqual({ ...defaults, foo: 'bar', baz: 'qux' });
  });

  it('handles additional boolean flags as booleans', () => {
    const options = getCliOptionsTest(['--foo', '--no-bar']);
    expect(options).toEqual({ ...defaults, foo: true, bar: false });
  });

  it('handles additional boolean text values as booleans', () => {
    const options = getCliOptionsTest(['--foo', 'true', '--bar=false']);
    expect(options).toEqual({ ...defaults, foo: true, bar: false });
  });

  it('handles additional numeric values as numbers', () => {
    const options = getCliOptionsTest(['--foo', '1', '--bar=2']);
    expect(options).toEqual({ ...defaults, foo: 1, bar: 2 });
  });

  it('handles additional option specified multiple times as array', () => {
    const options = getCliOptionsTest(['--foo', 'bar', '--foo', 'baz']);
    expect(options).toEqual({ ...defaults, foo: ['bar', 'baz'] });
  });

  // documenting current behavior (doesn't have to stay this way)
  it('for additional options, does not handle multiple values as part of array', () => {
    // in this case the trailing value "baz" would be treated as the command since it's the first
    // positional option
    const options = getCliOptionsTest(['--foo', 'bar', 'baz']);
    expect(options).toEqual({ ...defaults, foo: 'bar', command: 'baz' });
  });
});
