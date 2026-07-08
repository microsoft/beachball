import { Command, Option, type OutputConfiguration } from 'commander';
import { createAppTokenHelper } from './createAppTokenHelper';
import type { AppTokenHelperOptions, GetInstallationTokenOptions, RevokeAppTokenOptions } from './types';
import { AuthError, parsePermissionsArg } from './validationHelpers';
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

const outputModes = ['azure', 'azure-pipelines', 'stdout'] as const;

/** Options parsed for the default `token` command. */
interface TokenCliOptions extends AppTokenHelperOptions, GetInstallationTokenOptions {
  output: (typeof outputModes)[number];
  azureTokenVariable?: string;
}

async function runCreateToken(options: TokenCliOptions): Promise<void> {
  const { output, azureTokenVariable } = options;

  if (output !== 'stdout') {
    if (!azureTokenVariable) {
      throw new AuthError('--azure-token-variable (AZURE_TOKEN_VARIABLE) is required unless --output is stdout');
    }
    if (!/^[A-Za-z_]\w*$/.test(azureTokenVariable)) {
      throw new AuthError('--azure-token-variable (AZURE_TOKEN_VARIABLE) must be an environment-style variable name');
    }
  }

  const getInstallationToken = createAppTokenHelper({
    appClientId: options.appClientId,
    keyId: options.keyId,
    githubApiUrl: options.githubApiUrl,
  });

  const { token } = await getInstallationToken({
    repository: options.repository,
    permissions: options.permissions,
  });

  if (output === 'stdout') {
    console.log(token);
  } else {
    console.log(`##vso[task.setvariable variable=${azureTokenVariable};isSecret=true]${token}`);
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
    )
    .addOption(
      new Option('--permissions <list>', 'Comma- or newline-separated permission:level entries')
        .env('PERMISSIONS')
        .argParser(parsePermissionsArg)
    )
    .addOption(
      new Option('--output <mode>', 'Where to write the token').choices(outputModes).default('stdout').env('OUTPUT')
    )
    .addOption(
      new Option(
        '--azure-token-variable <name>',
        'Azure Pipelines variable name for the token (required unless --output is stdout)'
      ).env('AZURE_TOKEN_VARIABLE')
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
