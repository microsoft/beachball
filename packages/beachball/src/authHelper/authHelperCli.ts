import { Command, InvalidArgumentError, Option, type OutputConfiguration } from 'commander';
import fs from 'node:fs';
import { updateLockFileRegistry } from './updateLockFileRegistry';
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
  /** Current working directory. */
  cwd: string;
  /** Environment override for tests */
  env?: NodeJS.ProcessEnv;
  outputOptions?: OutputConfiguration;
  exitOverride?: boolean;
}

type TokenCliOptions = Omit<CreateAppTokenOptions, 'keyInfo'> & AppPrivateKeyInfo & { ciOutputName?: string };

async function runCreateToken(options: TokenCliOptions, command: Command, env: NodeJS.ProcessEnv): Promise<void> {
  const { ciOutputName: outputName, ...otherOptions } = options;

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
    token = await createAppToken({ ...tokenOptions, keyInfo: { privateKey } });
  } else if ('keyId' in otherOptions) {
    const { keyId, ...tokenOptions } = otherOptions;
    token = await createAppToken({ ...tokenOptions, keyInfo: { keyId } });
  } else {
    command.error("error: one of '--key-id' or '--private-key' must be specified");
  }

  if (outputCiPlatform === 'github-actions' && githubOutput) {
    console.log(`::add-mask::${token}`);
    fs.appendFileSync(githubOutput, `${outputName}=${token}\n`, 'utf8');
  } else if (outputCiPlatform === 'azure-pipelines') {
    console.log(`##vso[task.setvariable variable=${outputName};isSecret=true;isOutput=true]${token}`);
  } else {
    console.log(token);
  }
}

function buildProgram(context: CliContext): Command {
  const program = new Command()
    .name('beachball-auth-helper')
    .description('Authentication utilities for CI workflows.')
    .addHelpText('afterAll', `\nFull setup and examples: ${authHelperDocsUrl}\n`);
  context.exitOverride && program.exitOverride();
  context.outputOptions && program.configureOutput(context.outputOptions);

  const githubApiUrlOption = () =>
    new Option('--github-api-url <url>', 'GitHub REST API URL (for GitHub Enterprise Server)').default(
      defaultGitHubApiUrl
    );

  const createCommand = program
    .command('create-github-app-token')
    .description('Create a repository-scoped GitHub App installation token')
    .addOption(new Option('--app-client-id <id>', 'GitHub App client ID (not a secret)').makeOptionMandatory())
    .addOption(
      new Option('--key-id <keyId>', 'Azure Key Vault key ID used to sign the app JWT').conflicts('privateKey')
    )
    .addOption(
      new Option(
        '--private-key <pem>',
        'Provide via PRIVATE_KEY env: PEM-encoded GitHub App private key (escaped newlines are accepted)'
      )
        .env('PRIVATE_KEY')
        .conflicts('keyId')
    )
    .addOption(
      new Option('--repository <owner/repo>', 'Repository to scope the token to, in owner/repo format')
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
      ).argParser(parsePermissions)
    )
    .addOption(
      new Option(
        '--ci-output-name <NAME>',
        'Save the token as an Azure Pipelines secret step output or masked GitHub Actions step output'
      ).argParser(value => {
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
Signing:
Provide exactly one signing source: --key-id for Azure Key Vault or PRIVATE_KEY for a PEM-encoded private key.

Output:
By default, the token is written to stdout. With --ci-output-name, it is written as a secret Azure Pipelines output or masked GitHub Actions output.

Tokens expire after one hour. Create them immediately before use and revoke them when finished.`
  );

  program
    .command('revoke-github-app-token')
    .description('Revoke a GitHub App installation token')
    .addOption(
      new Option('--token <token>', 'Provide via TOKEN env: Installation token to revoke')
        .env('TOKEN')
        .makeOptionMandatory()
    )
    .addOption(githubApiUrlOption())
    .action(async (options: RevokeAppTokenOptions) => {
      await revokeAppToken(options);
    });

  program
    .command('update-lock-registry')
    .description('For npm / yarn v1 only: Update lock file registry URLs to point to a private registry')
    .addOption(new Option('--registry <url>', 'Private npm registry URL').makeOptionMandatory())
    .addOption(new Option('--revert', 'Restore lock file URLs to the default public registry'))
    .action((options: { registry: string; revert?: boolean }) => {
      updateLockFileRegistry({ ...options, cwd: context.cwd });
    });

  return program;
}

const originalEnv = process.env;

/**
 * Build and run the CLI, wiring commander's error handling to the provided context.
 *
 * Final error handling and exit handling is in `authHelperBin.ts`.
 */
export async function runAuthHelperCli(context: CliContext): Promise<void> {
  const program = buildProgram(context);
  context.env && (process.env = context.env);
  try {
    await program.parseAsync(context.argv);
  } finally {
    process.env = originalEnv;
  }
}
