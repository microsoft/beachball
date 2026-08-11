import { Command, InvalidArgumentError, Option, type OutputConfiguration } from 'commander';
import fs from 'node:fs';
import { BeachballError } from '../types/BeachballError';
import { createAppToken } from './createAppToken';
import { defaultGitHubApiUrl } from './requestHelpers';
import { revokeAppToken } from './revokeAppToken';
import type { AppPrivateKeyInfo, CreateAppTokenOptions, RevokeAppTokenOptions } from './types';
import { parsePermissions } from './validationHelpers';

const authHelperDocsUrl = 'https://microsoft.github.io/beachball/concepts/ci-integration/auth-helper';

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
type TokenCliOptions = Omit<CreateAppTokenOptions, 'keyInfo'> & AppPrivateKeyInfo & { outputName?: string };

async function runCreateToken(options: TokenCliOptions, command: Command, env: NodeJS.ProcessEnv): Promise<void> {
  const { outputName, ...otherOptions } = options;

  let outputCiPlatform: 'azure-pipelines' | 'github-actions' | undefined;
  let githubOutput: string | undefined;
  if (outputName) {
    if (env.GITHUB_ACTIONS) {
      githubOutput = env.GITHUB_OUTPUT;
      if (!githubOutput) {
        throw new BeachballError('GITHUB_OUTPUT is required to set a step output in GitHub Actions');
      }
      outputCiPlatform = 'github-actions';
    } else if (env.TF_BUILD) {
      outputCiPlatform = 'azure-pipelines';
    } else {
      command.error('error: must be run in a CI environment (Azure Pipelines or GitHub Actions)');
    }
  }

  let token: string;
  if ('privateKey' in otherOptions) {
    const { privateKey, ...tokenOptions } = otherOptions;
    ({ token } = await createAppToken({ ...tokenOptions, keyInfo: { privateKey } }));
  } else if ('keyId' in otherOptions) {
    const { keyId, ...tokenOptions } = otherOptions;
    ({ token } = await createAppToken({ ...tokenOptions, keyInfo: { keyId } }));
  } else {
    command.error("error: one of '--key-id' or '--private-key' must be specified");
  }

  if (outputCiPlatform === 'github-actions' && githubOutput) {
    console.log(`::add-mask::${token}`);
    fs.appendFileSync(githubOutput, `${outputName}=${token}\n`, 'utf8');
  } else if (outputCiPlatform === 'azure-pipelines') {
    console.log(`##vso[task.setvariable variable=${outputName};isSecret=true]${token}`);
  } else {
    console.log(token);
  }
}

/** Build the commander program with the default `create` command and the `revoke` subcommand. */
export function buildProgram(context: CliContext): Command {
  const program = new Command()
    .name('beachball-auth-helper')
    .description('Create or revoke repository-scoped GitHub App installation tokens.')
    .addHelpText(
      'after',
      `\nTokens expire after one hour. Create them immediately before use and revoke them when finished.\nFull setup and CI examples: ${authHelperDocsUrl}\n`
    );
  context.exitOverride && program.exitOverride();
  context.outputOptions && program.configureOutput(context.outputOptions);

  const githubApiUrlOption = () =>
    new Option('--github-api-url <url>', 'GitHub REST API URL (for GitHub Enterprise Server)')
      .env('GITHUB_API_URL')
      .default(defaultGitHubApiUrl);

  const createCommand = program
    .command('create-gha-token', { isDefault: true })
    .description('Create a repository-scoped GitHub App installation token')
    .addOption(
      new Option('--app-client-id <id>', 'GitHub App client ID (not a secret)')
        .env('APP_CLIENT_ID')
        .makeOptionMandatory()
    )
    .addOption(
      new Option('--key-id <keyId>', 'Azure Key Vault key ID used to sign the app JWT')
        .env('KEY_ID')
        .conflicts('privateKey')
    )
    .addOption(
      new Option(
        '--private-key <pem>',
        'Should be passed as PRIVATE_KEY: PEM-encoded GitHub App private key (escaped newlines are accepted)'
      )
        .env('PRIVATE_KEY')
        .conflicts('keyId')
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
        '--output-name <NAME>',
        'Save the token as an Azure Pipelines secret variable or masked GitHub Actions step output'
      )
        .env('OUTPUT_NAME')
        .argParser(value => {
          if (!/^[A-Za-z_]\w*$/.test(value)) {
            throw new InvalidArgumentError('Must be an environment-style variable name.');
          }
          return value;
        })
    )
    .addOption(githubApiUrlOption())
    .action((options: TokenCliOptions, command: Command) =>
      runCreateToken(options, command, context.env ?? process.env)
    );

  createCommand.addHelpText(
    'after',
    `
Authentication:
  Provide exactly one signing source: --key-id/KEY_ID for Azure Key Vault,
  or PRIVATE_KEY for a PEM-encoded GitHub App private key.

Output:
  By default, the token is written to stdout. With --output-name, it becomes
  an Azure Pipelines secret variable or a masked GitHub Actions step output.

All options can be provided as environment variables. Full examples:
${authHelperDocsUrl}
`
  );

  program
    .command('revoke-gha-token')
    .description('Revoke a GitHub App installation token')
    .addOption(
      new Option('--token <token>', 'Should be passed as TOKEN: Installation token to revoke')
        .env('TOKEN')
        .makeOptionMandatory()
    )
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
