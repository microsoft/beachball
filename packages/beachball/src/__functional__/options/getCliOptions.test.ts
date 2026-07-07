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

  // More extensive option parsing tests are in BeachballCommand.test.ts
  it('parses options', () => {
    // use a basic option of each value type (except arrays, tested later)
    const options = getCliOptionsTest({ args: ['--type', 'patch', '--access=public', '--fetch', '--depth', '1'] });
    expect(options).toEqual({ ...defaults, type: 'patch', access: 'public', fetch: true, depth: 1 });
  });

  it('parses command and options', () => {
    const options = getCliOptionsTest({ args: ['publish', '--tag', 'foo'] });
    expect(options).toEqual({ ...defaults, command: 'publish', tag: 'foo' });
  });

  it('parses options given before the command', () => {
    const options = getCliOptionsTest({ args: ['--tag', 'foo', 'publish', '--scope', 'bar'] });
    expect(options).toEqual({ ...defaults, command: 'publish', tag: 'foo', scope: ['bar'] });
  });

  it('allows an array option to be specified multiple times', () => {
    const options = getCliOptionsTest({ args: ['publish', '--scope', 'foo', '--scope', 'bar'] });
    expect(options).toEqual({ ...defaults, command: 'publish', scope: ['foo', 'bar'] });
  });

  it('errors on invalid value', () => {
    const outputOptions = { writeOut: jest.fn(), writeErr: jest.fn() };
    expect(() => getCliOptionsTest({ args: ['--depth', 'foo'], outputOptions })).toThrow(CommanderError);
    expect(outputOptions.writeOut).not.toHaveBeenCalled();
    expect(outputOptions.writeErr).toHaveBeenCalledWith(
      "error: option '--depth <num>' argument 'foo' is invalid. Expected numeric value.\n"
    );
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

  it('shows help text', () => {
    const outputOptions = { writeOut: jest.fn(), writeErr: jest.fn() };
    expect(() => getCliOptionsTest({ args: ['--help'], outputOptions })).toThrow(CommanderError);
    expect(outputOptions.writeErr).not.toHaveBeenCalled();
    expect(outputOptions.writeOut).toHaveBeenCalledTimes(1);
    // Make sure the help text looks reasonable
    expect(outputOptions.writeOut.mock.calls[0][0]).toMatchSnapshot();
  });

  describe('config command', () => {
    it('parses config get with setting name', () => {
      const options = getCliOptionsTest({ args: ['config', 'get', 'branch'] });
      expect(options).toEqual({ ...defaults, command: 'config get', _extraPositionalArgs: ['branch'] });
    });

    it('parses config list', () => {
      const options = getCliOptionsTest({ args: ['config', 'list'] });
      expect(options).toEqual({ ...defaults, command: 'config list' });
    });

    it('parses config get with setting name and options', () => {
      const options = getCliOptionsTest({ args: ['config', 'get', 'tag', '--package', 'my-pkg'] });
      expect(options).toEqual({
        ...defaults,
        command: 'config get',
        _extraPositionalArgs: ['tag'],
        package: ['my-pkg'],
      });
    });

    it('errors if config is missing a subcommand', () => {
      const outputOptions = { writeOut: jest.fn(), writeErr: jest.fn() };
      expect(() => getCliOptionsTest({ args: ['config'], outputOptions })).toThrow(CommanderError);
      expect(outputOptions.writeOut).not.toHaveBeenCalled();
      // this shows the config help text
      expect(outputOptions.writeErr).toHaveBeenCalledWith(expect.stringMatching(/^Usage:/));
    });

    it('errors for non-config command with extra positional args', () => {
      const outputOptions = { writeOut: jest.fn(), writeErr: jest.fn() };
      expect(() => getCliOptionsTest({ args: ['check', 'extra'], outputOptions })).toThrow(CommanderError);
      expect(outputOptions.writeOut).not.toHaveBeenCalled();
      expect(outputOptions.writeErr).toHaveBeenCalledWith(
        "error: too many arguments for 'check'. Expected 0 arguments but got 1.\n"
      );
    });
  });
});
