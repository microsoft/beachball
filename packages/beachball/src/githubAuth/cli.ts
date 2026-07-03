import { createGitHubAppAuth, revokeToken } from './api';
import { createAzureCliKeyVaultSigner } from './azureCliSigner';
import type { GetInstallationTokenOptions, GitHubAppAuthOptions } from './types';
import { assertValue, defaultGitHubApiUrl, parsePermissions, splitList } from './validationHelpers';

type OutputMode = 'azure' | 'azure-pipelines' | 'stdout';
const validOutput: OutputMode[] = ['azure', 'azure-pipelines', 'stdout'];

/** Parsed environment variables used by the CLI. */
export interface CliEnv {
  // used directly
  githubApiUrl: string;
  revokeToken?: string;

  // processed by getOtherOptions
  appClientId?: string;
  keyId?: string;
  output: string;
  azureTokenVariable?: string;

  // processed by getTokenOptions
  owner?: string;
  enterprise?: string;
  repositories?: string;
  permissions?: string;

  // used for initial validation
  hasHttpProxy: boolean;
  nodeUseEnvProxy?: string;
}

/** Read the CLI options from environment variables (defaults to `process.env`). */
export function readEnv(source: NodeJS.ProcessEnv = process.env): CliEnv {
  return {
    githubApiUrl: source['GITHUB_API_URL'] || defaultGitHubApiUrl,
    revokeToken: source['REVOKE_TOKEN'],

    appClientId: source['APP_CLIENT_ID'],
    keyId: source['KEY_ID'],
    output: source['OUTPUT'] || 'stdout',
    azureTokenVariable: source['AZURE_TOKEN_VARIABLE'],

    owner: source['OWNER'],
    enterprise: source['ENTERPRISE'],
    repositories: source['REPOSITORIES'],
    permissions: source['PERMISSIONS'],

    hasHttpProxy: !!(source['https_proxy'] || source['HTTPS_PROXY'] || source['http_proxy'] || source['HTTP_PROXY']),
    nodeUseEnvProxy: source['NODE_USE_ENV_PROXY'],
  };
}

export function getOtherOptions(env: CliEnv): Required<Pick<GitHubAppAuthOptions, 'appClientId' | 'keyId'>> & {
  outputMode: OutputMode;
  /** Always set unless `outputMode` is `'stdout'` */
  azureTokenVariable?: string;
} {
  const output = env.output.trim().toLowerCase();
  if (!validOutput.includes(output as OutputMode)) {
    throw new Error(`OUTPUT must be one of: ${validOutput.join(', ')}`);
  }
  const outputMode = output as OutputMode;

  const azureTokenVariable =
    outputMode === 'stdout' ? undefined : assertValue(env.azureTokenVariable, 'AZURE_TOKEN_VARIABLE must be set');
  if (azureTokenVariable && !/^[A-Za-z_]\w*$/.test(azureTokenVariable)) {
    throw new Error('AZURE_TOKEN_VARIABLE must be an environment-style variable name');
  }

  return {
    outputMode,
    azureTokenVariable,
    appClientId: assertValue(env.appClientId, 'APP_CLIENT_ID must be set'),
    keyId: assertValue(env.keyId, 'KEY_ID must be set'),
  };
}

export function getTokenOptions(env: CliEnv): GetInstallationTokenOptions {
  const { enterprise, owner } = env;
  const repositories = splitList(env.repositories);
  const permissions = parsePermissions(env.permissions);

  let tokenOptions: GetInstallationTokenOptions;
  if (enterprise) {
    if (owner || repositories.length) {
      throw new Error('Cannot use ENTERPRISE with OWNER or REPOSITORIES');
    }
    tokenOptions = { enterprise, permissions };
  } else if (repositories.length) {
    tokenOptions = { owner, repositories, permissions };
  } else if (owner) {
    tokenOptions = { owner, permissions };
  } else {
    throw new Error('OWNER, REPOSITORIES, or ENTERPRISE must be set');
  }
  return tokenOptions;
}

function reportError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  const errorPrefix = process.env.TF_BUILD ? '##vso[task.logissue type=error]' : 'error:';
  console.error(`${errorPrefix} ${message}`);
}

async function main(): Promise<void> {
  const env = readEnv();

  if (env.hasHttpProxy && env.nodeUseEnvProxy !== '1') {
    throw new Error(
      'A proxy environment variable is set, but Node.js native proxy support is not enabled. Set NODE_USE_ENV_PROXY=1 before running this tool.'
    );
  }

  const { githubApiUrl, revokeToken: revokeTokenValue } = env;

  if (revokeTokenValue) {
    await revokeToken({ githubApiUrl, token: revokeTokenValue });
    return;
  }

  // Do all env option validation first
  const tokenOptions = getTokenOptions(env);
  const { appClientId, keyId, outputMode, azureTokenVariable } = getOtherOptions(env);

  const githubAuth = createGitHubAppAuth({
    appClientId,
    signer: createAzureCliKeyVaultSigner(keyId),
    githubApiUrl,
  });

  const installationToken = await githubAuth.getInstallationToken(tokenOptions);

  if (outputMode === 'stdout') {
    process.stdout.write(`${installationToken.token}\n`);
  } else {
    process.stdout.write(
      `##vso[task.setvariable variable=${azureTokenVariable};isSecret=true]${installationToken.token}\n`
    );
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    reportError(error);
    process.exitCode = 1;
  });
}
