import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { CommanderError } from 'commander';
import fs from 'node:fs';
import { runAuthHelperCli, type CliContext } from '../../authHelper/authHelperCli';
import * as authModule from '../../authHelper/createAppToken';
import { defaultGitHubApiUrl } from '../../authHelper/requestHelpers';
import * as revokeModule from '../../authHelper/revokeAppToken';

jest.mock('../../authHelper/createAppToken');
jest.mock('../../authHelper/revokeAppToken');
jest.mock('node:fs');

const { createAppToken } = jest.mocked(authModule);
const { revokeAppToken } = jest.mocked(revokeModule);
const mockAppendFileSync = jest.mocked(fs.appendFileSync);

describe('authHelperCli', () => {
  // This can't use initMockLogs since it aggregates writeOut/writeErr and console logs
  let out: string[] = [];
  let err: string[] = [];

  function getContext(args: string[], env?: NodeJS.ProcessEnv): CliContext {
    return {
      argv: ['node', 'authHelperCli.js', ...args],
      env: env || {},
      outputOptions: {
        writeOut: message => out.push(message.trim()),
        writeErr: message => err.push(message.trim()),
        getErrHelpWidth: () => 100,
        getOutHelpWidth: () => 100,
      },
      exitOverride: true,
    };
  }

  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation((...msg) => out.push(msg.join(' ')));
    jest.spyOn(console, 'error').mockImplementation((...msg) => err.push(msg.join(' ')));
  });

  afterEach(() => {
    out = [];
    err = [];
  });

  it.each(['top level', 'create-github-app-token', 'revoke-github-app-token'])(
    'shows help text for %s',
    async command => {
      const context = getContext([...(command === 'top level' ? [] : [command]), '--help']);
      await expect(runAuthHelperCli(context)).rejects.toThrow(CommanderError);
      expect(err).toEqual([]);
      expect(out.join('\n\n')).toMatchSnapshot();
    }
  );

  describe('token command', () => {
    const mockToken = 'ghs_test_token';
    const clientIdArg = ['--app-client-id', 'Iv1.client'];
    const keyIdArg = ['--key-id', 'key-id'];
    const repoArg = ['--repository', 'org/repo'];
    const requiredArgs = ['create-github-app-token', ...clientIdArg, ...keyIdArg, ...repoArg] as const;
    const defaults = {
      appClientId: 'Iv1.client',
      githubApiUrl: defaultGitHubApiUrl,
      repository: { owner: 'org', name: 'repo' },
    };

    beforeEach(() => {
      createAppToken.mockResolvedValue(mockToken);
    });

    it('creates a token and writes it to stdout by default', async () => {
      const context = getContext([...requiredArgs]);
      await runAuthHelperCli(context);

      expect(createAppToken).toHaveBeenCalledWith({ ...defaults, keyInfo: { keyId: 'key-id' } });
      expect(out).toEqual([mockToken]);
    });

    it('honors --github-api-url', async () => {
      const context = getContext([...requiredArgs, '--github-api-url', 'https://ghe.example.com/api/v3']);
      await runAuthHelperCli(context);

      expect(createAppToken).toHaveBeenCalledWith({
        ...defaults,
        keyInfo: { keyId: 'key-id' },
        githubApiUrl: 'https://ghe.example.com/api/v3',
      });
      expect(out).toEqual([mockToken]);
    });

    it('creates a token using a private key from an environment variable', async () => {
      const context = getContext(['create-github-app-token', ...clientIdArg, ...repoArg], {
        PRIVATE_KEY: 'private-key',
      });
      await runAuthHelperCli(context);

      expect(createAppToken).toHaveBeenCalledWith({ ...defaults, keyInfo: { privateKey: 'private-key' } });
      expect(out).toEqual([mockToken]);
    });

    it('does not read non-secret options from environment variables', async () => {
      const context = getContext(['create-github-app-token'], {
        APP_CLIENT_ID: 'Iv1.client',
        KEY_ID: 'key-id',
        REPOSITORY: 'org/repo',
      });
      await expect(runAuthHelperCli(context)).rejects.toThrow(CommanderError);
      expect(err[0]).toMatch(/required option '--app-client-id <id>' not specified/);
    });

    it('parses permissions', async () => {
      const context = getContext([...requiredArgs, '--permissions', 'contents:read  ,foo:write,bar:admin']);
      await runAuthHelperCli(context);

      expect(createAppToken).toHaveBeenCalledWith(
        expect.objectContaining({ permissions: { contents: 'read', foo: 'write', bar: 'admin' } })
      );
    });

    it('rejects invalid permissions', async () => {
      const context = getContext([...requiredArgs, '--permissions', 'contents:bogus']);
      await expect(runAuthHelperCli(context)).rejects.toThrow(CommanderError);
      expect(err[0]).toMatchInlineSnapshot(
        `"error: option '--permissions <list>' argument 'contents:bogus' is invalid. Invalid permission level for contents: bogus"`
      );
    });

    it('parses repository', async () => {
      const context = getContext([...requiredArgs, '--repository', 'my-org/my-repo']);
      await runAuthHelperCli(context);

      expect(createAppToken).toHaveBeenCalledWith(
        expect.objectContaining({ repository: { owner: 'my-org', name: 'my-repo' } })
      );
    });

    it.each<[string, string]>([
      ['bare repository name', 'my-repo'],
      ['empty repository owner', '/my-repo'],
      ['empty repository name', 'my-org/'],
      ['too many segments', 'a/b/c'],
    ])('rejects %s', async (_description, repo) => {
      const context = getContext([...requiredArgs, '--repository', repo]);
      await expect(runAuthHelperCli(context)).rejects.toThrow(CommanderError);
      expect(err[0]).toEqual(
        `error: option '--repository <owner/repo>' argument '${repo}' is invalid. Expected format 'owner/repository'.`
      );
    });

    it('rejects invalid variable name', async () => {
      const context = getContext([...requiredArgs, '--ci-output-name', 'bad name!']);
      await expect(runAuthHelperCli(context)).rejects.toThrow(CommanderError);
      expect(err[0]).toMatchInlineSnapshot(
        `"error: option '--ci-output-name <NAME>' argument 'bad name!' is invalid. Must be an environment-style variable name."`
      );
    });

    it('writes an Azure Pipelines secret step output with --ci-output-name', async () => {
      const context = getContext([...requiredArgs, '--ci-output-name', 'MY_TOKEN'], { TF_BUILD: 'true' });
      await runAuthHelperCli(context);
      expect(out).toEqual([`##vso[task.setvariable variable=MY_TOKEN;isSecret=true;isOutput=true]${mockToken}`]);
    });

    it('sets a masked GitHub Actions step output with --ci-output-name', async () => {
      const context = getContext([...requiredArgs, '--ci-output-name', 'MY_TOKEN'], {
        GITHUB_ACTIONS: 'true',
        GITHUB_OUTPUT: '/github/output',
      });
      await runAuthHelperCli(context);

      expect(out).toEqual([`::add-mask::${mockToken}`]);
      expect(mockAppendFileSync).toHaveBeenCalledWith('/github/output', `MY_TOKEN=${mockToken}\n`, 'utf8');
    });

    it('requires GITHUB_OUTPUT to set a GitHub Actions step output', async () => {
      const context = getContext([...requiredArgs, '--ci-output-name', 'MY_TOKEN'], { GITHUB_ACTIONS: 'true' });
      await expect(runAuthHelperCli(context)).rejects.toThrow(/GITHUB_OUTPUT is required/);
    });

    it('rejects an invalid --ci-output-name', async () => {
      const context = getContext([...requiredArgs, '--ci-output-name', 'bad name!']);
      await expect(runAuthHelperCli(context)).rejects.toThrow(/environment-style variable name/);
    });

    it.each(['--app-client-id', '--repository'])('requires %s', async missing => {
      const args = [...requiredArgs];
      const index = args.indexOf(missing);
      args.splice(index, 2);

      const context = getContext(args);
      await expect(runAuthHelperCli(context)).rejects.toThrow(CommanderError);
      expect(err[0]).toMatch(new RegExp(`error: required option '${missing}.*?' not specified`));
    });

    it('requires a key ID or private key', async () => {
      const context = getContext(['create-github-app-token', ...clientIdArg, ...repoArg]);
      await expect(runAuthHelperCli(context)).rejects.toThrow(CommanderError);
      expect(err[0]).toEqual("error: one of '--key-id' or '--private-key' must be specified");
    });

    it('rejects a key ID combined with a private key', async () => {
      const context = getContext([...requiredArgs, '--private-key', 'private-key']);
      await expect(runAuthHelperCli(context)).rejects.toThrow(CommanderError);
      expect(err[0]).toMatch(/option '--key-id <keyId>' cannot be used with option '--private-key <pem>'/);
    });

    it('rejects unknown options', async () => {
      const context = getContext([...requiredArgs, '--nope']);
      await expect(runAuthHelperCli(context)).rejects.toThrow(CommanderError);
      expect(err[0]).toMatchInlineSnapshot(`"error: unknown option '--nope'"`);
    });
  });

  describe('revoke command', () => {
    it('revokes a token passed as a flag', async () => {
      const context = getContext(['revoke-github-app-token', '--token', 'ghs_revoke_me']);
      await runAuthHelperCli(context);

      expect(revokeAppToken).toHaveBeenCalledWith({
        githubApiUrl: defaultGitHubApiUrl,
        token: 'ghs_revoke_me',
      });
      expect(createAppToken).not.toHaveBeenCalled();
    });

    it('reads the token from TOKEN', async () => {
      const context = getContext(['revoke-github-app-token'], { TOKEN: 'ghs_from_env' });
      await runAuthHelperCli(context);

      expect(revokeAppToken).toHaveBeenCalledWith({
        githubApiUrl: defaultGitHubApiUrl,
        token: 'ghs_from_env',
      });
    });

    it('honors --github-api-url', async () => {
      const context = getContext([
        'revoke-github-app-token',
        '--token',
        'ghs_revoke_me',
        '--github-api-url',
        'https://ghe.example.com/api/v3',
      ]);
      await runAuthHelperCli(context);

      expect(revokeAppToken).toHaveBeenCalledWith({
        githubApiUrl: 'https://ghe.example.com/api/v3',
        token: 'ghs_revoke_me',
      });
    });

    it('requires a token', async () => {
      const context = getContext(['revoke-github-app-token']);
      await expect(runAuthHelperCli(context)).rejects.toThrow(/--token/);
    });
  });
});
