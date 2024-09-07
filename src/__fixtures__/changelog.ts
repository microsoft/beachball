import fs from 'fs-extra';
import path from 'path';
import _ from 'lodash';
import { ChangelogJson } from '../types/ChangeLog';
import { markerComment } from '../changelog/renderChangelog';

/** Placeholder commit as replaced by cleanChangelogJson */
export const fakeCommit = '(sha1)';

/**
 * Read the CHANGELOG.md under the given package path, sanitizing any dates for snapshots.
 * Returns null if it doesn't exist.
 */
export function readChangelogMd(packagePath: string): string | null {
  const changelogFile = path.join(packagePath, 'CHANGELOG.md');
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
 * Read the CHANGELOG.json under the given package path.
 * Returns null if it doesn't exist.
 */
export function readChangelogJson(packagePath: string, cleanForSnapshot: boolean = false): ChangelogJson | null {
  const changelogJsonFile = path.join(packagePath, 'CHANGELOG.json');
  if (!fs.existsSync(changelogJsonFile)) {
    return null;
  }
  const json = fs.readJSONSync(changelogJsonFile, { encoding: 'utf-8' });
  return cleanForSnapshot ? cleanChangelogJson(json) : json;
}

/**
 * Clean changelog json for a snapshot: replace dates and SHAs with placeholders.
 * Note: this clones the changelog object rather than modifying the original.
 */
export function cleanChangelogJson(changelog: ChangelogJson | null): ChangelogJson | null {
  if (!changelog) {
    return null;
  }
  changelog = _.cloneDeep(changelog);

  for (const entry of changelog.entries) {
    // Only replace properties if they existed, to help catch bugs if things are no longer written
    if (entry.date) {
      entry.date = '(date)';
    }

    for (const comments of Object.values(entry.comments)) {
      for (const comment of comments!) {
        if (comment.commit) {
          comment.commit = fakeCommit;
        }
      }
    }
  }
  return changelog;
}
