/**
 * !!!! IMPORTANT !!!!
 * Changes made to interfaces here can affect custom changelog rendering done by end-user.
 */

import type { ChangeType } from './ChangeInfo';

/**
 * Entry ("comment") in CHANGELOG.json from a change file or dependent bump.
 * These objects are saved under the `ChangelogJson`'s `entries[].comments[type]`.
 *
 * (This is based on an individual `ChangeFileInfo` from ./ChangeInfo.ts, but with some different
 * naming and details.)
 */
export interface ChangelogEntry {
  /** Change comment */
  comment: string;
  /** Author email */
  author: string;
  /**
   * Commit hash, if available.
   *
   * Will be undefined if `options.changelog.includeCommitHashes` is false, or if the hash could
   * not be determined. In beachball v2, dependent bump entries used the placeholder string
   * `"not available"` instead; that behavior was removed in v3.
   */
  commit?: string;
  /** Package name the change was in */
  package: string;
  /** Extra info added to the change file via custom prompts */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [extraInfo: string]: any;
}

/**
 * Intermediate info used to generate a CHANGELOG.json entry for an individual version.
 * Usually this is for a single package. If using grouped changelogs, it could be for multiple packages.
 */
export interface PackageChangelog {
  /** Package name (if a grouped changelog, for the primary package) */
  name: string;
  /** Version creation date */
  date: Date;
  /** Version number (if a grouped changelog, for the primary package) */
  version: string;
  /**
   * Corresponding git tag name (if a grouped changelog, for the primary package).
   *
   * Will be undefined if no git tag will actually be created for this package — i.e. `gitTags`
   * is disabled and `getGitTag` is not set (or returned `null`).
   *
   * If the package's `getGitTag` returns multiple tags, this is the first ("most specific") one.
   */
  tag?: string;
  /** Changes in this version */
  comments: { [k in ChangeType]?: ChangelogEntry[] };
}

/**
 * CHANGELOG.json entry for an individual version (under `ChangelogJson`'s `entries`).
 * Usually this is for a single package. If using grouped changelogs, it could be for multiple packages.
 */
export type ChangelogJsonEntry = Omit<PackageChangelog, 'name' | 'date'> & {
  /** Version creation date as a string */
  date: string;
};

/**
 * CHANGELOG.json file contents.
 */
export interface ChangelogJson {
  /** Package name */
  name: string;
  /** Entries for each package version */
  entries: ChangelogJsonEntry[];
}
