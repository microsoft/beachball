import type { components } from '@octokit/openapi-types';

/** A GitHub release as returned by the REST API (`GET /repos/{owner}/{repo}/releases`). */
export type GitHubRelease = components['schemas']['release'];

/** Parsed `owner/repo` identifier. */
export interface RepoId {
  owner: string;
  repo: string;
}

/** Options controlling changelog generation. */
export interface ProperChangelogOptions {
  /** Repository to read releases from, as `owner/repo`. */
  repo: RepoId;
  /** Auth token for the GitHub API (optional; requests are rate-limited without one). */
  token?: string;
  /** Include prerelease releases (default: false). Draft releases are always excluded. */
  includePrereleases?: boolean;
  /** Only include releases up to and including this tag (most recent bound). */
  from?: string;
  /** Only include releases down to and including this tag (oldest bound). */
  to?: string;
  /** Maximum number of releases to include. */
  limit?: number;
}
