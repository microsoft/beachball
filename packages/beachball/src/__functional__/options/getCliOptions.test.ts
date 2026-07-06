import { describe, expect, it, jest } from '@jest/globals';
import { findProjectRoot, resolveRemoteAndBranch } from 'workspace-tools';
import { getCliOptions, type ProgramContext } from '../../options/getCliOptions';
import { CommanderError } from 'commander';

jest.mock('workspace-tools', () => ({
  ...jest.requireActual<typeof import('workspace-tools')>('workspace-tools'),
  resolveRemoteAndBranch: jest.fn((options: { branch?: string }) => {
    if (options.branch?.includes('/')) {
      const [remote, remoteBranch] = options.branch.split('/');
      return { remote, remoteBranch };
    }
    return { remote: 'origin', remoteBranch: options.branch || 'main' };
  }),
  findProjectRoot: jest.fn(() => 'fake-root'),
}));

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

  /** test wrapper for `getCliOptions` which adds common args */
  function getCliOptionsTest(
    params: {
      args: string[];
    } & Omit<Partial<ProgramContext>, 'argv'>
  ) {
    const { args, ...rest } = params;
    return getCliOptions({
      argv: ['node', 'beachball', ...args],
      cwd: projectRoot,
      env: {},
      outputOptions: { writeOut: jest.fn(), writeErr: jest.fn() },
      ...rest,
    });
  }

  // start by making sure nothing went wrong with the mock
  it('uses fake project root', () => {
    expect(findProjectRoot(process.cwd())).toEqual(projectRoot);
  });

  it('parses no args (adds path to result)', () => {
    const options = getCliOptionsTest({ args: [] });
    expect(options).toEqual(defaults);
  });

  it('parses command', () => {
    const options = getCliOptionsTest({ args: ['check'] });
    expect(options).toEqual({ ...defaults, command: 'check' });
  });

  it('parses options', () => {
    // use a basic option of each value type (except arrays, tested later)
    const options = getCliOptionsTest({ args: ['--type', 'patch', '--access=public', '--fetch', '--depth', '1'] });
    expect(options).toEqual({ ...defaults, type: 'patch', access: 'public', fetch: true, depth: 1 });
  });

  it('parses command and options', () => {
    const options = getCliOptionsTest({ args: ['publish', '--tag', 'foo'] });
    expect(options).toEqual({ ...defaults, command: 'publish', tag: 'foo' });
  });

  it('parses string option in separate and combined forms', () => {
    const options = getCliOptionsTest({ args: ['--type', 'patch', '--access=public'] });
    expect(options).toEqual({ ...defaults, type: 'patch', access: 'public' });
  });

  it('parses number option in separate and combined forms', () => {
    const options = getCliOptionsTest({ args: ['--depth', '1', '--concurrency=2'] });
    expect(options).toEqual({ ...defaults, depth: 1, concurrency: 2 });
  });

  it('parses array options with multiple values', () => {
    const options = getCliOptionsTest({ args: ['--scope', 'foo', 'bar'] });
    expect(options).toEqual({ ...defaults, scope: ['foo', 'bar'] });
  });

  it('parses array option specified multiple times', () => {
    const options = getCliOptionsTest({ args: ['--scope', 'foo', '--scope', 'bar'] });
    expect(options).toEqual({ ...defaults, scope: ['foo', 'bar'] });
  });

  it('parses array option with a single value in combined syntax', () => {
    const options = getCliOptionsTest({ args: ['--scope=foo'] });
    expect(options).toEqual({ ...defaults, scope: ['foo'] });
  });

  it('parses array option with a mix of combined, separate, and multiple values', () => {
    const options = getCliOptionsTest({ args: ['--scope=foo', '--scope', 'bar', 'baz'] });
    expect(options).toEqual({ ...defaults, scope: ['foo', 'bar', 'baz'] });
  });

  // documenting that this is not currently supported (could change in the future if desired)
  it('does not parse values with commas as separate array entries', () => {
    const options = getCliOptionsTest({ args: ['--scope', 'a,b', '--scope=c,d'] });
    expect(options).toEqual({ ...defaults, scope: ['a,b', 'c,d'] });
  });

  it('parses negated boolean option', () => {
    const options = getCliOptionsTest({ args: ['--no-fetch'] });
    expect(options).toEqual({ ...defaults, fetch: false });
  });

  it('parses negated boolean option with camelCase name', () => {
    // gitTags is a camelCase option, and yargs also accepts the hyphenated negation form
    const options = getCliOptionsTest({ args: ['--no-git-tags'] });
    expect(options).toEqual({ ...defaults, gitTags: false });
  });

  it('errors on boolean option with value', () => {
    // TODO override error handling for this case to recommend --no-<opt> instead
    expect(() => getCliOptionsTest({ args: ['--fetch=false'] })).toThrowErrorMatchingInlineSnapshot(
      `"error: unknown option '--fetch=false'"`
    );
    // TODO "false" is currently interpreted as the command...
    // const opt = getCliOptionsTest({ args: ['--yes', 'false'] });
    // expect(opt).toEqual({ ...defaults });
  });

  it('errors on invalid numeric value', () => {
    const outputOptions = { writeOut: jest.fn(), writeErr: jest.fn() };
    expect(() => getCliOptionsTest({ args: ['--depth', 'foo'], outputOptions })).toThrow(CommanderError);
    expect(outputOptions.writeOut).not.toHaveBeenCalled();
    expect(outputOptions.writeErr).toHaveBeenCalledWith(
      "error: option '--depth <value>' argument 'foo' is invalid. Expected numeric value.\n"
    );
  });

  it('converts hyphenated options to camel case', () => {
    const options = getCliOptionsTest({ args: ['--git-tags', '--dependent-change-type', 'patch'] });
    expect(options).toEqual({ ...defaults, gitTags: true, dependentChangeType: 'patch' });
  });

  it('supports camel case for options defined as hyphenated', () => {
    const options = getCliOptionsTest({
      args: ['--gitTags', '--dependentChangeType', 'patch', '--disallowed-change-types', 'major', 'minor'],
    });
    expect(options).toEqual({
      ...defaults,
      gitTags: true,
      dependentChangeType: 'patch',
      disallowedChangeTypes: ['major', 'minor'],
    });
  });

  it('supports camel case combined with an = value', () => {
    const options = getCliOptionsTest({ args: ['--dependentChangeType=patch'] });
    expect(options).toEqual({ ...defaults, dependentChangeType: 'patch' });
  });

  it('parses short option aliases', () => {
    const options = getCliOptionsTest({ args: ['publish', '-t', 'test', '-r', 'http://whatever', '-y'] });
    expect(options).toEqual({ ...defaults, command: 'publish', tag: 'test', registry: 'http://whatever', yes: true });
  });

  it('parses long option aliases', () => {
    const options = getCliOptionsTest({ args: ['--config', 'path/to/config.json', '--force', '--since', 'main'] });
    expect(options).toEqual({ ...defaults, configPath: 'path/to/config.json', forceVersions: true, fromRef: 'main' });
  });

  it('for canary command, adds canary tag and ignores regular tag', () => {
    const options = getCliOptionsTest({ args: ['canary', '--tag', 'bar'] });
    expect(options).toEqual({ ...defaults, command: 'canary', tag: 'canary' });
  });

  it('for canary command, uses canaryName as tag and ignores regular tag', () => {
    const options = getCliOptionsTest({ args: ['canary', '--canary-name', 'foo', '--tag', 'bar'] });
    expect(options).toEqual({ ...defaults, command: 'canary', canaryName: 'foo', tag: 'foo' });
  });

  it('does not set tag to canaryName for non-canary command', () => {
    const options = getCliOptionsTest({ args: ['publish', '--canary-name', 'foo', '--tag', 'bar'] });
    expect(options).toEqual({ ...defaults, command: 'publish', canaryName: 'foo', tag: 'bar' });
  });

  it('falls back to given cwd as path if findProjectRoot fails', () => {
    mockFindProjectRoot.mockImplementationOnce(() => {
      throw new Error('nope');
    });
    const options = getCliOptionsTest({ args: [], cwd: 'somewhere' });
    expect(options).toEqual({ ...defaults, path: 'somewhere' });
  });

  it('uses provided branch with remote', () => {
    // resolveRemoteAndBranch is mocked to use branch.split('/') as remote and remoteBranch
    const options = getCliOptionsTest({ args: ['--branch', 'someremote/foo'] });
    expect(options).toEqual({ ...defaults, branch: 'someremote/foo' });
    expect(resolveRemoteAndBranch).toHaveBeenCalled();
  });

  it('adds default remote to branch without remote', () => {
    const options = getCliOptionsTest({ args: ['--branch', 'foo'] });
    expect(options).toEqual({ ...defaults, branch: 'origin/foo' });
    expect(resolveRemoteAndBranch).toHaveBeenCalledWith({
      branch: 'foo',
      verbose: undefined,
      cwd: projectRoot,
      strict: true,
    });
  });

  it('errors on unknown long option', () => {
    // Unlike yargs-parser, commander errors on unknown options (intentional breaking change for v3)
    const outputOptions = { writeOut: jest.fn(), writeErr: jest.fn() };
    expect(() => getCliOptionsTest({ args: ['--foo', 'bar'], outputOptions })).toThrow(CommanderError);
    expect(outputOptions.writeOut).not.toHaveBeenCalled();
    expect(outputOptions.writeErr).toHaveBeenCalledWith("error: unknown option '--foo'\n");
  });

  it('errors on unknown boolean flag', () => {
    const outputOptions = { writeOut: jest.fn(), writeErr: jest.fn() };
    expect(() => getCliOptionsTest({ args: ['--no-bar'], outputOptions })).toThrow(CommanderError);
    expect(outputOptions.writeOut).not.toHaveBeenCalled();
    expect(outputOptions.writeErr).toHaveBeenCalledWith(expect.stringContaining("error: unknown option '--no-bar'"));
  });

  it('errors on unknown negated boolean flag', () => {
    const outputOptions = { writeOut: jest.fn(), writeErr: jest.fn() };
    expect(() => getCliOptionsTest({ args: ['--no-bar'], outputOptions })).toThrow(CommanderError);
    expect(outputOptions.writeOut).not.toHaveBeenCalled();
    expect(outputOptions.writeErr).toHaveBeenCalledWith(expect.stringContaining("error: unknown option '--no-bar'"));
  });

  it('errors on unknown option combined with a valid option', () => {
    expect(() => getCliOptionsTest({ args: ['--tag', 'foo', '--bar=2'] })).toThrowErrorMatchingInlineSnapshot(
      `"error: unknown option '--bar=2'"`
    );
  });

  it('allows an array option to be specified multiple times', () => {
    const options = getCliOptionsTest({ args: ['--scope', 'foo', '--scope', 'bar'] });
    expect(options).toEqual({ ...defaults, scope: ['foo', 'bar'] });
  });

  it('gets NPM_TOKEN from environment', () => {
    const options = getCliOptionsTest({ args: [], env: { NPM_TOKEN: 'fake-token' } });
    expect(options).toEqual({ ...defaults, token: 'fake-token' });
  });

  it('prefers CLI token over NPM_TOKEN environment variable', () => {
    const options = getCliOptionsTest({ args: ['--token', 'cli-token'], env: { NPM_TOKEN: 'env-token' } });
    expect(options).toEqual({ ...defaults, token: 'cli-token' });
  });

  it('prefers empty string CLI token over NPM_TOKEN environment variable', () => {
    const options = getCliOptionsTest({ args: ['--token', ''], env: { NPM_TOKEN: 'env-token' } });
    expect(options).toEqual({ ...defaults, token: '' });
  });

  describe('config command', () => {
    it('parses config get with setting name', () => {
      const options = getCliOptionsTest({ args: ['config', 'get', 'branch'] });
      expect(options).toEqual({ ...defaults, command: 'config', _extraPositionalArgs: ['get', 'branch'] });
    });

    it('parses config get with setting name and options', () => {
      const options = getCliOptionsTest({ args: ['config', 'get', 'tag', '--package', 'my-pkg'] });
      expect(options).toEqual({
        ...defaults,
        command: 'config',
        _extraPositionalArgs: ['get', 'tag'],
        package: ['my-pkg'],
      });
    });

    it('errors for non-config command with extra positional args', () => {
      const outputOptions = { writeOut: jest.fn(), writeErr: jest.fn() };
      expect(() => getCliOptionsTest({ args: ['check', 'extra'], outputOptions })).toThrow(CommanderError);
      expect(outputOptions.writeOut).not.toHaveBeenCalled();
      expect(outputOptions.writeErr).toHaveBeenCalledWith(
        'error: too many arguments. Expected 1 argument but got 2.\n'
      );
    });
  });
});
