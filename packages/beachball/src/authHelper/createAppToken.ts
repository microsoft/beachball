import { sign } from 'node:crypto';
import { defaultGitHubApiUrl, githubHeaders, requestJson, retryTransient } from './requestHelpers';
import { signWithAzureCli } from './signWithAzureCli';
import type { CreateAppTokenOptions } from './types';
import { requiredIntegerProperty, requiredStringProperty } from './validationHelpers';

export type GitHubAppInstallationResponse = { id: number; app_slug: string };
export type GitHubAccessTokenResponse = {
  token: string;
  /** ISO 8601 expiration timestamp. Installation tokens always expire after 60 minutes. */
  expires_at: string;
  permissions?: Record<string, unknown>;
};

/** Create a repository-scoped GitHub App installation token. */
export async function createAppToken(options: CreateAppTokenOptions): Promise<string> {
  const { appClientId, githubApiUrl = defaultGitHubApiUrl, permissions, repository, keyInfo } = options;

  // Reuse a single JWT across installation discovery and token creation.
  const jwt = await createJwt({ appClientId, keyInfo });

  let installationId: number | undefined;

  return retryTransient(async () => {
    installationId ??= await discoverInstallation({ githubApiUrl, repository, jwt });

    const token = await requestJson<GitHubAccessTokenResponse>(
      `${githubApiUrl}/app/installations/${installationId}/access_tokens`,
      {
        method: 'POST',
        headers: githubHeaders(jwt, true),
        body: JSON.stringify({ repositories: [repository.name], ...(permissions ? { permissions } : {}) }),
      },
      'Could not create GitHub App installation token'
    );

    // Currently not using expires_at or permissions
    return requiredStringProperty(token, 'token', 'GitHub did not return an installation token');
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

  // not currently using app_slug
  return requiredIntegerProperty(result, 'id', 'GitHub did not return an installation ID');
}

function base64url(value: string | Uint8Array): string {
  return Buffer.from(value).toString('base64url');
}
