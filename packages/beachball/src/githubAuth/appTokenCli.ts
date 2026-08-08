import { Command, InvalidArgumentError, Option, type OutputConfiguration } from 'commander';
import { createAppTokenHelper } from './createAppTokenHelper';
import type { AppTokenHelperOptions, GetInstallationTokenOptions, RevokeAppTokenOptions } from './types';
import { parsePermissions } from './validationHelpers';
import { defaultGitHubApiUrl } from './requestHelpers';
import { revokeAppToken } from './revokeAppToken';

/** Injectable dependencies so the CLI can be driven and observed in tests. */
export interface CliContext {
  /** Full argv (including `node` and the script path), e.g. `process.argv`. */
  argv: string[];
  /** Environment override for tests */
  env?: NodeJS.ProcessEnv;
  outputOptions?: OutputConfiguration;
  exitOverride?: boolean;
}

/** Options parsed for the default `token` command. */
interface TokenCliOptions extends AppTokenHelperOptions, GetInstallationTokenOptions {
  secretVariable?: string;
}

async function runCreateToken(options: TokenCliOptions): Promise<void> {
  const { secretVariable } = options;

  const getInstallationToken = createAppTokenHelper({
    appClientId: options.appClientId,
    keyId: options.keyId,
    githubApiUrl: options.githubApiUrl,
  });

  const { token } = await getInstallationToken({
    repository: options.repository,
    permissions: options.permissions,
  });

  if (secretVariable) {
    console.log(`##vso[task.setvariable variable=${secretVariable};isSecret=true]${token}`);
  } else {
    console.log(token);
  }
}

/** Build the commander program with the default `create` command and the `revoke` subcommand. */
export function buildProgram(context: CliContext): Command {
  const program = new Command()
    .name('github-app-token')
    .description('Create or revoke GitHub App installation tokens signed with an Azure Key Vault key.');
  context.exitOverride && program.exitOverride();
  context.outputOptions && program.configureOutput(context.outputOptions);

  const githubApiUrlOption = () =>
    new Option('--github-api-url <url>', 'GitHub REST API URL (for GitHub Enterprise Server)')
      .env('GITHUB_API_URL')
      .default(defaultGitHubApiUrl);

  program
    .command('create', { isDefault: true })
    .description('Create a GitHub App installation token')
    .addOption(
      new Option('--app-client-id <id>', 'GitHub App client ID (not a secret)')
        .env('APP_CLIENT_ID')
        .makeOptionMandatory()
    )
    .addOption(
      new Option('--key-id <keyId>', 'Azure Key Vault key ID used to sign the app JWT')
        .env('KEY_ID')
        .makeOptionMandatory()
    )
    .addOption(
      new Option('--repository <owner/repo>', 'Repository to scope the token to, in owner/repo format')
        .env('REPOSITORY')
        .makeOptionMandatory()
        .argParser(value => {
          const parts = value.split('/');
          if (parts.length === 2 && parts[0] && parts[1]) {
            return { owner: parts[0], name: parts[1] };
          }
          throw new InvalidArgumentError(`Expected format 'owner/repository'.`);
        })
    )
    .addOption(
      new Option(
        '--permissions <list>',
        'Comma-separated list of "permission:level" entries (e.g. "contents: read, pull_requests: write")'
      )
        .env('PERMISSIONS')
        .argParser(parsePermissions)
    )
    .addOption(
      new Option(
        '--secret-variable <NAME>',
        'For Azure Pipelines: save the token as a secret variable with this name (instead of logging the plain token)'
      )
        .env('SECRET_VARIABLE')
        .argParser(value => {
          if (!/^[A-Za-z_]\w*$/.test(value)) {
            throw new InvalidArgumentError('Must be an environment-style variable name.');
          }
          return value;
        })
    )
    .addOption(githubApiUrlOption())
    .action(runCreateToken);

  program
    .command('revoke')
    .description('Revoke a GitHub App installation token')
    .addOption(new Option('--token <token>', 'Installation token to revoke').env('TOKEN').makeOptionMandatory())
    .addOption(githubApiUrlOption())
    .action(async (options: RevokeAppTokenOptions) => {
      await revokeAppToken(options);
    });

  return program;
}

const originalEnv = process.env;

/** Build and run the CLI, wiring commander's error handling to the provided context. */
export async function runAppTokenCli(context: CliContext): Promise<void> {
  const program = buildProgram(context);
  context.env && (process.env = context.env);
  try {
    await program.parseAsync(context.argv);
  } finally {
    process.env = originalEnv;
  }
}
