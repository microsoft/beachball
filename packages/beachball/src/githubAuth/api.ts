import { createAzureCliKeyVaultSigner } from './azureCliSigner';
import { GitHubRequestError, requestJson, requestNoContent, retryTransient } from './requestHelpers';
import type { GetInstallationTokenOptions, GitHubAppAuthOptions, InstallationToken } from './types';
import {
  assertValue,
  defaultGitHubApiUrl,
  isRecord,
  normalizeRepositoryTarget,
  requiredIntegerProperty,
  requiredStringProperty,
  splitList,
  validatePermissions,
} from './validationHelpers';

const defaultRefreshWindowMs = 5 * 60 * 1000;

export interface GitHubAppAuth {
  getInstallationToken(options: GetInstallationTokenOptions): Promise<InstallationToken>;
  revokeToken(token: string): Promise<void>;
}

function base64url(value: string | Uint8Array): string {
  return Buffer.from(value).toString('base64url');
}

function stableObject(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, stableObject(entry)])
  );
}

function githubHeaders(token: string, json = false): Record<string, string> {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

type InstallationTarget =
  | { type: 'enterprise'; enterprise: string }
  | { type: 'owner'; owner: string }
  | { type: 'repository'; owner: string; repositories: string[] };

function resolveInstallationTarget(options: GetInstallationTokenOptions): InstallationTarget {
  const repositories = splitList(options.repositories);

  if (options.enterprise) {
    if (options.owner || repositories.length > 0) {
      throw new Error("Cannot use 'enterprise' with 'owner' or 'repositories'");
    }
    return { type: 'enterprise', enterprise: options.enterprise };
  }

  if (repositories.length > 0) {
    return { type: 'repository', ...normalizeRepositoryTarget(options.owner, repositories) };
  }

  const owner = assertValue(options.owner, 'owner is required to discover installation ID');
  return { type: 'owner', owner };
}

export async function revokeToken(params: { githubApiUrl?: string; token: string }): Promise<void> {
  const { githubApiUrl = defaultGitHubApiUrl, token } = params;
  await requestNoContent(
    `${githubApiUrl}/installation/token`,
    {
      method: 'DELETE',
      headers: githubHeaders(token),
    },
    'Could not revoke GitHub App installation token'
  );
}

export function createGitHubAppAuth(options: GitHubAppAuthOptions): GitHubAppAuth {
  assertValue(options.appClientId, 'appClientId is required');
  if (options.signer && options.keyId) {
    throw new Error("Cannot use both 'signer' and 'keyId'");
  }
  if (!options.signer && !options.keyId) {
    throw new Error("Either 'signer' or 'keyId' is required");
  }

  const appClientId = options.appClientId;
  const signer = options.signer ?? createAzureCliKeyVaultSigner(assertValue(options.keyId, "'keyId' is required"));
  const refreshWindowMs = options.refreshWindowMs ?? defaultRefreshWindowMs;
  const githubApiUrl = options.githubApiUrl ?? defaultGitHubApiUrl;
  const installationCache = new Map<string, { id: number; appSlug: string }>();
  const tokenCache = new Map<string, InstallationToken>();

  async function createJwt(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const iat = now - 60;
    const exp = now + 9 * 60;
    const header = base64url(JSON.stringify({ typ: 'JWT', alg: 'RS256' }));
    const payload = base64url(JSON.stringify({ iat, exp, iss: appClientId }));
    const signingInput = `${header}.${payload}`;
    const signature = await signer(signingInput);
    return `${signingInput}.${signature}`;
  }

  async function discoverInstallation(
    target: InstallationTarget,
    getJwt: () => Promise<string>
  ): Promise<{ id: number; appSlug: string }> {
    const cacheKey = JSON.stringify(target);
    const cached = installationCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const jwt = await getJwt();
    let installation: unknown;
    switch (target.type) {
      case 'enterprise':
        installation = await requestJson(
          `${githubApiUrl}/enterprises/${target.enterprise}/installation`,
          { headers: githubHeaders(jwt) },
          'Could not discover GitHub App installation ID'
        );
        break;
      case 'owner':
        try {
          installation = await requestJson(
            `${githubApiUrl}/orgs/${target.owner}/installation`,
            { headers: githubHeaders(jwt) },
            'Could not discover GitHub App installation ID'
          );
        } catch (error) {
          if (!(error instanceof GitHubRequestError) || error.status !== 404) {
            throw error;
          }

          installation = await requestJson(
            `${githubApiUrl}/users/${target.owner}/installation`,
            { headers: githubHeaders(jwt) },
            'Could not discover GitHub App installation ID'
          );
        }
        break;
      case 'repository':
        installation = await requestJson(
          `${githubApiUrl}/repos/${target.owner}/${assertValue(
            target.repositories[0],
            'repository is required'
          )}/installation`,
          { headers: githubHeaders(jwt) },
          'Could not discover GitHub App installation ID'
        );
        break;
    }

    const result = {
      id: requiredIntegerProperty(installation, 'id', 'GitHub did not return an installation ID'),
      appSlug: requiredStringProperty(installation, 'app_slug', 'GitHub did not return an App slug'),
    };
    installationCache.set(cacheKey, result);
    return result;
  }

  async function getInstallationToken(opts: GetInstallationTokenOptions): Promise<InstallationToken> {
    const target = resolveInstallationTarget(opts);
    const permissions = validatePermissions(opts.permissions);
    return retryTransient(async () => {
      // Reuse a single JWT per attempt across installation discovery and token creation.
      let jwtPromise: Promise<string> | undefined;
      const getJwt = () => (jwtPromise ??= createJwt());

      const installation = await discoverInstallation(target, getJwt);
      const repositories = target.type === 'repository' ? target.repositories : [];
      const cacheKey = JSON.stringify({
        installationId: installation.id,
        repositories: [...repositories].sort(),
        permissions: stableObject(permissions),
      });
      const cached = tokenCache.get(cacheKey);
      if (cached && Date.now() < new Date(cached.expiresAt).getTime() - refreshWindowMs) {
        return cached;
      }

      const jwt = await getJwt();
      const body = {
        ...(repositories.length > 0 ? { repositories } : {}),
        ...(permissions ? { permissions } : {}),
      };
      const token = await requestJson<{
        token?: string;
        expires_at?: string;
        permissions?: Record<string, unknown>;
      }>(
        `${githubApiUrl}/app/installations/${installation.id}/access_tokens`,
        {
          method: 'POST',
          headers: githubHeaders(jwt, true),
          body: JSON.stringify(body),
        },
        'Could not create GitHub App installation token'
      );

      const result: InstallationToken = {
        token: requiredStringProperty(token, 'token', 'GitHub did not return an installation token'),
        expiresAt: requiredStringProperty(
          token,
          'expires_at',
          'GitHub did not return an installation token expiration'
        ),
        installationId: installation.id,
        appSlug: installation.appSlug,
        repositories,
        permissions: isRecord(token?.permissions) ? token.permissions : (permissions ?? {}),
      };
      tokenCache.set(cacheKey, result);
      return result;
    });
  }

  return {
    getInstallationToken,
    revokeToken: (token: string) => revokeToken({ githubApiUrl, token }),
  };
}
