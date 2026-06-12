import type { GitHubRelease, RepoId } from './types.ts';

const apiBase = 'https://api.github.com';
const perPage = 100;

/** Parse the `Link` response header and return the URL with `rel="next"`, if any. */
function getNextLink(linkHeader: string | null): string | undefined {
  if (!linkHeader) {
    return undefined;
  }

  for (const part of linkHeader.split(',')) {
    const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (match && match[2] === 'next') {
      return match[1];
    }
  }
  return undefined;
}

/**
 * Fetch all releases for a repository from the GitHub REST API, following pagination.
 *
 * If `token` is provided, it is sent as a bearer token; otherwise requests are made
 * unauthenticated (and are subject to stricter rate limits).
 */
export async function fetchReleases(repo: RepoId, token?: string): Promise<GitHubRelease[]> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'proper-changelog',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const releases: GitHubRelease[] = [];
  let url: string | undefined = `${apiBase}/repos/${repo.owner}/${repo.repo}/releases?per_page=${perPage}`;

  while (url) {
    const response: Response = await fetch(url, { headers });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `Failed to fetch releases for ${repo.owner}/${repo.repo}: ${response.status} ${response.statusText}` +
          (body ? `\n${body}` : '')
      );
    }

    const page = (await response.json()) as GitHubRelease[];
    releases.push(...page);

    url = getNextLink(response.headers.get('link'));
  }

  return releases;
}
