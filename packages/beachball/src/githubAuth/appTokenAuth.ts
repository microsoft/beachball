import { signWithAzureCli } from './signWithAzureCli';
import { requestJson, requestNoContent, retryTransient } from './requestHelpers';
import type { GetInstallationTokenOptions, GitHubAppAuthOptions, InstallationToken } from './types';
import {
  defaultGitHubApiUrl,
  isRecord,
  parseRepository,
  requiredIntegerProperty,
  requiredStringProperty,
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

type Repository = { owner: string; name: string };

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
  const { appClientId, keyId, githubApiUrl = defaultGitHubApiUrl } = options;
  const installationCache = new Map<string, { id: number; appSlug: string }>();
  const tokenCache = new Map<string, InstallationToken>();

  async function createJwt(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const iat = now - 60;
    const exp = now + 9 * 60;
    const header = base64url(JSON.stringify({ typ: 'JWT', alg: 'RS256' }));
    const payload = base64url(JSON.stringify({ iat, exp, iss: appClientId }));
    const signingInput = `${header}.${payload}`;
    const signature = await signWithAzureCli(keyId, signingInput);
    return `${signingInput}.${signature}`;
  }

  async function discoverInstallation(
    repository: Repository,
    getJwt: () => Promise<string>
  ): Promise<{ id: number; appSlug: string }> {
    const cacheKey = `${repository.owner}/${repository.name}`;
    const cached = installationCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const jwt = await getJwt();
    const installation = await requestJson(
      `${githubApiUrl}/repos/${repository.owner}/${repository.name}/installation`,
      { headers: githubHeaders(jwt) },
      'Could not discover GitHub App installation ID'
    );

    const result = {
      id: requiredIntegerProperty(installation, 'id', 'GitHub did not return an installation ID'),
      appSlug: requiredStringProperty(installation, 'app_slug', 'GitHub did not return an App slug'),
    };
    installationCache.set(cacheKey, result);
    return result;
  }

  async function getInstallationToken(opts: GetInstallationTokenOptions): Promise<InstallationToken> {
    const repository = parseRepository(opts.repository);
    const { permissions } = opts;

    return retryTransient(async () => {
      // Reuse a single JWT per attempt across installation discovery and token creation.
      let jwtPromise: Promise<string> | undefined;
      const getJwt = () => (jwtPromise ??= createJwt());

      const installation = await discoverInstallation(repository, getJwt);
      const repositories = [repository.name];
      const cacheKey = JSON.stringify({
        installationId: installation.id,
        repositories,
        permissions: stableObject(permissions),
      });
      const cached = tokenCache.get(cacheKey);
      if (cached && Date.now() < new Date(cached.expiresAt).getTime() - defaultRefreshWindowMs) {
        return cached;
      }

      const jwt = await getJwt();
      const body = {
        repositories,
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
