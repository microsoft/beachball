import { createGitHubAppAuth, revokeToken } from './appTokenAuth';
import type { GetInstallationTokenOptions, GitHubAppAuthOptions } from './types';
import { assertValue, defaultGitHubApiUrl, parsePermissions } from './validationHelpers';

type OutputMode = 'azure' | 'azure-pipelines' | 'stdout';
const validOutput: OutputMode[] = ['azure', 'azure-pipelines', 'stdout'];

/** Parsed environment variables used by the CLI. */
export interface CliEnv {
  // used directly
  githubApiUrl: string;
  revokeToken?: string;

  appClientId?: string;
  keyId?: string;
  output: string;
  azureTokenVariable?: string;

  // processed by getTokenOptions
  repository?: string;
  permissions?: string;
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

    repository: source['REPOSITORY'],
    permissions: source['PERMISSIONS'],
  };
}

export function getOptions(env: CliEnv): Omit<GitHubAppAuthOptions, 'githubApiUrl'> &
  GetInstallationTokenOptions & {
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
    repository: assertValue(env.repository, 'REPOSITORY must be set'),
    permissions: parsePermissions(env.permissions),
  };
}

function reportError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  const errorPrefix = process.env.TF_BUILD ? '##vso[task.logissue type=error]' : 'error:';
  console.error(`${errorPrefix} ${message}`);
}

async function main(): Promise<void> {
  const env = readEnv();

  const { githubApiUrl, revokeToken: revokeTokenValue } = env;

  if (revokeTokenValue) {
    await revokeToken({ githubApiUrl, token: revokeTokenValue });
    return;
  }

  // Do all env option validation first
  const { repository, permissions, appClientId, keyId, outputMode, azureTokenVariable } = getOptions(env);

  const githubAuth = createGitHubAppAuth({ appClientId, keyId, githubApiUrl });

  const { token } = await githubAuth.getInstallationToken({ repository, permissions });

  if (outputMode === 'stdout') {
    process.stdout.write(`${token}\n`);
  } else {
    process.stdout.write(`##vso[task.setvariable variable=${azureTokenVariable};isSecret=true]${token}\n`);
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    reportError(error);
    process.exitCode = 1;
  });
}
