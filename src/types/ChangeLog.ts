/**
 * !!!! IMPORTANT !!!!
 * Changes made to interfaces here can affect custom changelog rendering done by end-user.
 */

import { ChangeType } from './ChangeInfo';

export interface ChangelogEntry {
  /** Change comment */
  comment: string;
  /** Author email */
  author: string;
  /** Commit hash */
  commit: string;
  /** Package name the change was in */
  package: string;
}

/**
 * Changelog info for an individual version. Usually this is for a single package.
 * If using grouped changelogs, it could be for multiple packages.
 */
export interface PackageChangelog {
  /** Package name (if a grouped changelog, for the primary package) */
  name: string;
  /** Version creation date */
  date: Date;
  /** Version number (if a grouped changelog, for the primary package) */
  version: string;
  /** Corresponding git tag name (if a grouped changelog, for the primary package) */
  tag: string;
  /** Changes in this version */
  comments: { [k in ChangeType]?: ChangelogEntry[] };
}

/**
 * CHANGELOG.json entry for an individual version. Usually this is for a single package.
 * If using grouped changelogs, it could be for multiple packages.
 */
export type ChangelogJsonEntry = Omit<PackageChangelog, 'name' | 'date'> & {
  /** Version creation date as a string */
  date: string;
};

export interface ChangelogJson {
  name: string;
  entries: ChangelogJsonEntry[];
}
