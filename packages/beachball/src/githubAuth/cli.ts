import {
  createGitHubAppAuth,
  type GetInstallationTokenOptions,
  type InstallationToken,
  normalizeRepositoryTarget,
  type PermissionLevel,
  type Permissions,
  revokeToken,
  splitRepositoryNames,
} from './api.js';
import { createAzureCliKeyVaultSigner } from './azureCliSigner.js';

type OutputMode = 'azure' | 'azure-pipelines' | 'stdout';

const proxyEnvironmentKeys = ['https_proxy', 'HTTPS_PROXY', 'http_proxy', 'HTTP_PROXY'] as const;

function ensureNativeProxySupport(): void {
  if (proxyEnvironmentKeys.some(key => process.env[key]) && process.env['NODE_USE_ENV_PROXY'] !== '1') {
    throw new Error(
      'A proxy environment variable is set, but Node.js native proxy support is not enabled. Set NODE_USE_ENV_PROXY=1 before running this tool.'
    );
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set`);
  }
  return value;
}

function getAppClientId(): string {
  const appClientId = process.env['APP_CLIENT_ID'];
  if (!appClientId) {
    throw new Error('APP_CLIENT_ID must be set');
  }
  return appClientId;
}

function validatePermissionName(key: string): void {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    throw new Error(`Invalid permission name: ${key}`);
  }
}

function validatePermissionLevel(key: string, level: unknown): PermissionLevel {
  if (level !== 'read' && level !== 'write' && level !== 'admin') {
    throw new Error(`Invalid permission level for ${key}: ${level}`);
  }
  return level;
}

function parsePermissions(value: string | undefined): Permissions | undefined {
  if (!value) {
    return undefined;
  }

  const permissions: Permissions = {};
  for (const entry of splitRepositoryNames(value)) {
    const parts = entry.split(':');
    if (parts.length !== 2) {
      throw new Error(`Permission entry must include an explicit level: ${entry}`);
    }

    const key = parts[0]?.trim();
    const rawLevel = parts[1]?.trim();
    if (!key) {
      throw new Error(`Permission entry must include a permission name: ${entry}`);
    }
    validatePermissionName(key);
    if (Object.hasOwn(permissions, key)) {
      throw new Error(`Duplicate permission: ${key}`);
    }
    permissions[key] = validatePermissionLevel(key, rawLevel);
  }

  return Object.keys(permissions).length === 0 ? undefined : permissions;
}

function validateVariableName(name: string, envName: string): void {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`${envName} must be an environment-style variable name`);
  }
}

function parseOutputMode(value: string | undefined): OutputMode {
  const output = (value || 'stdout').trim().toLowerCase();
  if (output === 'azure' || output === 'azure-pipelines' || output === 'stdout') {
    return output;
  }
  throw new Error('OUTPUT must be "azure", "azure-pipelines", or "stdout"');
}

function getTokenOptions(): GetInstallationTokenOptions {
  const enterprise = process.env['ENTERPRISE'];
  const owner = process.env['OWNER'];
  const repositories = splitRepositoryNames(process.env['REPOSITORIES']);
  const permissions = parsePermissions(process.env['PERMISSIONS']);

  if (enterprise) {
    if (owner || repositories.length > 0) {
      throw new Error('Cannot use ENTERPRISE with OWNER or REPOSITORIES');
    }
    return { enterprise, permissions };
  }

  if (repositories.length > 0) {
    return { ...normalizeRepositoryTarget(owner, repositories, undefined), permissions };
  }

  if (owner) {
    return { owner, permissions };
  }

  throw new Error('OWNER, REPOSITORIES, or ENTERPRISE must be set');
}

function writeAzurePipelinesOutput(installationToken: InstallationToken): void {
  const variableName = requiredEnv('AZURE_TOKEN_VARIABLE');
  validateVariableName(variableName, 'AZURE_TOKEN_VARIABLE');
  process.stdout.write(`##vso[task.setvariable variable=${variableName};isSecret=true]${installationToken.token}\n`);
}

function writeOutput(installationToken: InstallationToken, output: OutputMode): void {
  switch (output) {
    case 'azure':
    case 'azure-pipelines':
      writeAzurePipelinesOutput(installationToken);
      break;
    case 'stdout':
      process.stdout.write(`${installationToken.token}\n`);
      break;
  }
}

function reportError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`error: ${message}`);
}

async function main(): Promise<void> {
  ensureNativeProxySupport();

  const githubApiUrl = process.env['GITHUB_API_URL'] || 'https://api.github.com';

  const revokeTokenValue = process.env['REVOKE_TOKEN'];
  if (revokeTokenValue) {
    await revokeToken({ githubApiUrl, token: revokeTokenValue });
    return;
  }

  const githubAuth = createGitHubAppAuth({
    appClientId: getAppClientId(),
    signer: createAzureCliKeyVaultSigner(requiredEnv('KEY_ID')),
    githubApiUrl,
  });

  const installationToken = await githubAuth.getInstallationToken(getTokenOptions());
  writeOutput(installationToken, parseOutputMode(process.env['OUTPUT']));
}

void main().catch((error: unknown) => {
  reportError(error);
  process.exitCode = 1;
});
