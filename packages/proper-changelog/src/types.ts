import type { components } from '@octokit/openapi-types';

/** A GitHub release as returned by the REST API (`GET /repos/{owner}/{repo}/releases`). */
export type GitHubRelease = components['schemas']['release'];

/** Parsed `owner/repo` identifier. */
export interface RepoId {
  owner: string;
  repo: string;
}

/** Options as returned by `program.parse().opts()`. */
export interface RawCliOptions {
  /** Repository to read releases from. */
  repo?: RepoId;
  /** npm package name the repo was resolved from, if any (used for the changelog heading/filename). */
  package?: string;
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
  /**
   * Filter releases by tag name. A plain string matches tags that contain it (case-insensitive);
   * a value wrapped in slashes (e.g. `/^v1\./i`) is treated as a regular expression.
   */
  filter?: string;
  /** Only include releases published after this date. */
  since?: Date;
  /** Write output to this file */
  out?: string;
  /** If true, write to stdout instead of a file */
  stdout?: boolean;
}

/** Options controlling changelog generation. */
export type ProperChangelogOptions = Required<Pick<RawCliOptions, 'repo'>> & RawCliOptions;

/** Throw this to indicate an expected error (stack won't be logged) */
export class ChangelogError extends Error {
  name = 'ChangelogError';
}
