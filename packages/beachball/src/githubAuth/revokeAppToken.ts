import { defaultGitHubApiUrl, githubHeaders, requestNoContent } from './requestHelpers';
import type { RevokeAppTokenOptions } from './types';

/**
 * Revoke a GitHub app installation token.
 */
export async function revokeAppToken(options: RevokeAppTokenOptions): Promise<void> {
  const { githubApiUrl = defaultGitHubApiUrl, token } = options;
  await requestNoContent(
    `${githubApiUrl}/installation/token`,
    {
      method: 'DELETE',
      headers: githubHeaders(token),
    },
    'Could not revoke GitHub App installation token'
  );
}
