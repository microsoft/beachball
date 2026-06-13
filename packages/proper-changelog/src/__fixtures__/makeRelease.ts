import type { GitHubRelease } from '../types.ts';

/**
 * Create a {@link GitHubRelease} fixture with sensible defaults, overriding only the fields
 * relevant to a given test.
 */
export function makeRelease(overrides: Partial<GitHubRelease> = {}): GitHubRelease {
  const tag = overrides.tag_name ?? 'v1.0.0';
  return {
    url: 'https://api.github.com/repos/microsoft/some-repo/releases/1',
    html_url: `https://github.com/microsoft/some-repo/releases/tag/${tag}`,
    assets_url: '',
    upload_url: '',
    tarball_url: null,
    zipball_url: null,
    id: 1,
    node_id: 'node',
    tag_name: tag,
    target_commitish: 'main',
    name: tag,
    body: '',
    draft: false,
    prerelease: false,
    created_at: '2024-01-01T00:00:00Z',
    published_at: '2024-01-01T00:00:00Z',
    author: {} as GitHubRelease['author'], // not used
    assets: [],
    ...overrides,
  };
}
