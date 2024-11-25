import fs from 'fs-extra';
import path from 'path';
import { ChangelogJson } from '../types/ChangeLog';
import { markerComment } from '../changelog/renderChangelog';

/** Placeholder commit as replaced by cleanChangelogJson */
export const fakeCommit = '(sha1)';

/**
 * Read the CHANGELOG.md under the given package path, sanitizing any dates for snapshots.
 * Returns null if it doesn't exist.
 */
export function readChangelogMd(packagePath: string, filename?: string): string | null {
  const changelogFile = path.join(packagePath, filename || 'CHANGELOG.md');
  if (!fs.existsSync(changelogFile)) {
    return null;
  }
  const text = fs.readFileSync(changelogFile, { encoding: 'utf-8' });
  return text.replace(/\w\w\w, \d\d \w\w\w [\d :]+?GMT/gm, '(date)');
}

/** Get only the part of CHANGELOG.md after the marker comment. */
export function trimChangelogMd(changelogMd: string): string {
  return changelogMd.split(markerComment)[1].trim();
}

/**
 * Read the CHANGELOG.json, and clean it for a snapshot (unless `noClean` is true):
 * replace dates and SHAs with placeholders.
 * @param packagePath The path to the package directory.
 * @param filename The name of the changelog file. Defaults to 'CHANGELOG.json'.
 * @param noClean If true, don't clean the changelog for snapshots.
 * @returns The parsed changelog JSON, or null if it doesn't exist.
 */
export function readChangelogJson(packagePath: string, filename?: string, noClean?: boolean): ChangelogJson | null {
  const changelogJsonFile = path.join(packagePath, filename || 'CHANGELOG.json');
  if (!fs.existsSync(changelogJsonFile)) {
    return null;
  }

  const changelog = fs.readJSONSync(changelogJsonFile, { encoding: 'utf-8' }) as ChangelogJson;
  if (noClean) {
    return changelog;
  }

  for (const entry of changelog.entries) {
    // Only replace properties if they existed, to help catch bugs if things are no longer written
    if (entry.date) {
      entry.date = '(date)';
    }

    for (const comments of Object.values(entry.comments)) {
      for (const comment of comments) {
        if (comment.commit) {
          comment.commit = fakeCommit;
        }
      }
    }
  }
  return changelog;
}
