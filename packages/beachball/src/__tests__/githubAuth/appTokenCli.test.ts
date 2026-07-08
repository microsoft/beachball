import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as authModule from '../../githubAuth/createAppTokenHelper';
import * as revokeModule from '../../githubAuth/revokeAppToken';
import type { AppTokenHelper, InstallationToken } from '../../githubAuth/types';
import { runAppTokenCli, type CliContext } from '../../githubAuth/appTokenCli';
import { CommanderError } from 'commander';
import { defaultGitHubApiUrl } from '../../githubAuth/requestHelpers';

jest.mock('../../githubAuth/createAppTokenHelper');
jest.mock('../../githubAuth/revokeAppToken');

const { createAppTokenHelper } = authModule as jest.Mocked<typeof authModule>;
const { revokeAppToken } = revokeModule as jest.Mocked<typeof revokeModule>;

describe('appTokenCli', () => {
  let out: string[] = [];
  let err: string[] = [];

  function getContext(args: string[], env?: NodeJS.ProcessEnv): CliContext {
    return {
      argv: ['node', 'appTokenCli.js', ...args],
      env: env || {},
      outputOptions: { writeOut: message => out.push(message.trim()), writeErr: message => err.push(message.trim()) },
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

  describe('token command', () => {
    const mockToken = 'ghs_test_token';
    const mockGetInstallationToken = jest.fn<AppTokenHelper>();
    const installationToken: InstallationToken = {
      token: mockToken,
      expiresAt: '2099-01-01T00:00:00Z',
      installationId: 123,
      appSlug: 'test-app',
      repositories: ['repo'],
      permissions: {},
    };
    const clientIdArg = ['--app-client-id', 'Iv1.client'];
    const keyIdArg = ['--key-id', 'key-id'];
    const repoArg = ['--repository', 'org/repo'];
    const requiredArgs = ['create', ...clientIdArg, ...keyIdArg, ...repoArg] as const;

    beforeEach(() => {
      mockGetInstallationToken.mockResolvedValue(installationToken);
      createAppTokenHelper.mockReturnValue(mockGetInstallationToken);
    });

    it('creates a token and writes it to stdout by default', async () => {
      const context = getContext([...requiredArgs]);
      await runAppTokenCli(context);

      expect(createAppTokenHelper).toHaveBeenCalledWith({
        appClientId: 'Iv1.client',
        keyId: 'key-id',
        githubApiUrl: defaultGitHubApiUrl,
      });
      expect(mockGetInstallationToken).toHaveBeenCalledWith({ repository: 'org/repo', permissions: undefined });
      expect(out).toEqual([mockToken]);
    });

    it('reads options from environment variables', async () => {
      const context = getContext([], {
        APP_CLIENT_ID: 'Iv1.client',
        KEY_ID: 'key-id',
        REPOSITORY: 'org/repo',
        GITHUB_API_URL: 'https://ghe.example.com/api/v3',
      });
      await runAppTokenCli(context);

      expect(createAppTokenHelper).toHaveBeenCalledWith({
        appClientId: 'Iv1.client',
        keyId: 'key-id',
        githubApiUrl: 'https://ghe.example.com/api/v3',
      });
      expect(out).toEqual([mockToken]);
    });

    it('parses permissions', async () => {
      const context = getContext([...requiredArgs, '--permissions', 'contents:read  ,foo:write\nbar:admin']);
      await runAppTokenCli(context);

      expect(mockGetInstallationToken).toHaveBeenCalledWith({
        repository: 'org/repo',
        permissions: { contents: 'read', foo: 'write', bar: 'admin' },
      });
    });

    it('rejects invalid permissions', async () => {
      const context = getContext([...requiredArgs, '--permissions', 'contents:bogus']);
      await expect(runAppTokenCli(context)).rejects.toThrow(/Invalid permission level for contents: bogus/);
    });

    it('writes an Azure Pipelines variable command for azure output', async () => {
      const context = getContext([...requiredArgs, '--output', 'azure', '--azure-token-variable', 'MY_TOKEN']);
      await runAppTokenCli(context);

      expect(out).toEqual([`##vso[task.setvariable variable=MY_TOKEN;isSecret=true]${mockToken}`]);
    });

    it('requires --azure-token-variable for non-stdout output', async () => {
      const context = getContext([...requiredArgs, '--output', 'azure-pipelines']);
      await expect(runAppTokenCli(context)).rejects.toThrow(/--azure-token-variable .* is required/);
    });

    it('rejects an invalid --azure-token-variable name', async () => {
      const context = getContext([...requiredArgs, '--output', 'azure', '--azure-token-variable', 'bad name!']);
      await expect(runAppTokenCli(context)).rejects.toThrow(/environment-style variable name/);
    });

    it('rejects an invalid --output value', async () => {
      const context = getContext([...requiredArgs, '--output', 'bogus']);
      await expect(runAppTokenCli(context)).rejects.toThrow(CommanderError);
      expect(err[0].trim()).toMatchInlineSnapshot(
        `"error: option '--output <mode>' argument 'bogus' is invalid. Allowed choices are azure, azure-pipelines, stdout."`
      );
    });

    it.each(['--app-client-id', '--key-id', '--repository'])('requires %s', async missing => {
      const args = [...requiredArgs];
      const index = args.indexOf(missing);
      args.splice(index, 2);

      const context = getContext(args);
      await expect(runAppTokenCli(context)).rejects.toThrow(CommanderError);
      expect(err[0]).toMatch(new RegExp(`error: required option '${missing}.*?' not specified`));
    });
  });

  describe('revoke command', () => {
    it('revokes a token passed as a flag', async () => {
      const context = getContext(['revoke', '--token', 'ghs_revoke_me']);
      await runAppTokenCli(context);

      expect(revokeAppToken).toHaveBeenCalledWith({
        githubApiUrl: defaultGitHubApiUrl,
        token: 'ghs_revoke_me',
      });
      expect(createAppTokenHelper).not.toHaveBeenCalled();
    });

    it('reads the token from TOKEN', async () => {
      const context = getContext(['revoke'], { TOKEN: 'ghs_from_env' });
      await runAppTokenCli(context);

      expect(revokeAppToken).toHaveBeenCalledWith({
        githubApiUrl: defaultGitHubApiUrl,
        token: 'ghs_from_env',
      });
    });

    it('honors --github-api-url', async () => {
      const context = getContext([
        'revoke',
        '--token',
        'ghs_revoke_me',
        '--github-api-url',
        'https://ghe.example.com/api/v3',
      ]);
      await runAppTokenCli(context);

      expect(revokeAppToken).toHaveBeenCalledWith({
        githubApiUrl: 'https://ghe.example.com/api/v3',
        token: 'ghs_revoke_me',
      });
    });

    it('requires a token', async () => {
      const context = getContext(['revoke']);
      await expect(runAppTokenCli(context)).rejects.toThrow(/--token/);
    });
  });
});
