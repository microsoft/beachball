import { sign } from 'node:crypto';
import { defaultGitHubApiUrl, githubHeaders, requestJson, retryTransient } from './requestHelpers';
import { signWithAzureCli } from './signWithAzureCli';
import type { CreateAppTokenOptions, InstallationToken } from './types';
import { isRecord, requiredIntegerProperty, requiredStringProperty } from './validationHelpers';

export type GitHubAppInstallationResponse = { id: number; app_slug: string };
export type GitHubAccessTokenResponse = { token: string; expires_at: string; permissions?: Record<string, unknown> };

/** Create a repository-scoped GitHub App installation token. */
export async function createAppToken(options: CreateAppTokenOptions): Promise<InstallationToken> {
  const { appClientId, githubApiUrl = defaultGitHubApiUrl, permissions, repository, keyInfo } = options;

  // Reuse a single JWT across installation discovery and token creation.
  const jwt = await createJwt({ appClientId, keyInfo });

  let installation: { id: number; appSlug: string } | undefined;

  return retryTransient(async () => {
    installation ??= await discoverInstallation({ githubApiUrl, repository, jwt });
    const token = await requestJson<GitHubAccessTokenResponse>(
      `${githubApiUrl}/app/installations/${installation.id}/access_tokens`,
      {
        method: 'POST',
        headers: githubHeaders(jwt, true),
        body: JSON.stringify({ repositories: [repository.name], ...(permissions ? { permissions } : {}) }),
      },
      'Could not create GitHub App installation token'
    );

    return {
      token: requiredStringProperty(token, 'token', 'GitHub did not return an installation token'),
      expiresAt: requiredStringProperty(token, 'expires_at', 'GitHub did not return an installation token expiration'),
      installationId: installation.id,
      appSlug: installation.appSlug,
      permissions: isRecord(token?.permissions) ? token.permissions : (permissions ?? {}),
    };
  });
}

/** Sign a JWT signing input with a PEM-encoded GitHub App private key. */
export function _signWithPrivateKey(privateKey: string, signingInput: string): string {
  const normalizedPrivateKey = privateKey.replace(/\\n/g, '\n');
  return sign('RSA-SHA256', Buffer.from(signingInput), normalizedPrivateKey).toString('base64url');
}

async function createJwt(params: Pick<CreateAppTokenOptions, 'appClientId' | 'keyInfo'>): Promise<string> {
  const { appClientId, keyInfo } = params;
  const now = Math.floor(Date.now() / 1000);
  const iat = now - 60;
  const exp = now + 9 * 60;
  const header = base64url(JSON.stringify({ typ: 'JWT', alg: 'RS256' }));
  const payload = base64url(JSON.stringify({ iat, exp, iss: appClientId }));
  const signingInput = `${header}.${payload}`;
  let signature: string;
  if ('privateKey' in keyInfo) {
    signature = _signWithPrivateKey(keyInfo.privateKey, signingInput);
  } else {
    signature = await signWithAzureCli(keyInfo.keyId, signingInput);
  }
  return `${signingInput}.${signature}`;
}

async function discoverInstallation(
  params: Pick<CreateAppTokenOptions, 'githubApiUrl' | 'repository'> & { jwt: string }
) {
  const { jwt, githubApiUrl, repository } = params;

  const result = await requestJson<GitHubAppInstallationResponse>(
    `${githubApiUrl}/repos/${repository.owner}/${repository.name}/installation`,
    { headers: githubHeaders(jwt) },
    'Could not discover GitHub App installation ID'
  );

  return {
    id: requiredIntegerProperty(result, 'id', 'GitHub did not return an installation ID'),
    appSlug: requiredStringProperty(result, 'app_slug', 'GitHub did not return an App slug'),
  };
}

function base64url(value: string | Uint8Array): string {
  return Buffer.from(value).toString('base64url');
}
