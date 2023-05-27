import fs from 'fs-extra';
import path from 'path';
import _ from 'lodash';
import { SortedChangeTypes } from '../changefile/changeTypes';
import { ChangelogJson } from '../types/ChangeLog';

/** Read the CHANGELOG.md under the given package path, sanitizing any dates for snapshots */
export function readChangelogMd(packagePath: string): string {
  const changelogFile = path.join(packagePath, 'CHANGELOG.md');
  const text = fs.readFileSync(changelogFile, { encoding: 'utf-8' });
  return text.replace(/\w\w\w, \d\d \w\w\w [\d :]+?GMT/gm, '(date)');
}

/** Read the CHANGELOG.json under the given package path */
export function readChangelogJson(packagePath: string, cleanForSnapshot: boolean = false): ChangelogJson {
  const changelogJsonFile = path.join(packagePath, 'CHANGELOG.json');
  const json = fs.readJSONSync(changelogJsonFile, { encoding: 'utf-8' });
  return cleanForSnapshot ? cleanChangelogJson(json) : json;
}

/**
 * Clean changelog json for a snapshot: replace dates and SHAs with placeholders.
 * Note: this clones the changelog object rather than modifying the original.
 */
export function cleanChangelogJson(changelog: ChangelogJson): ChangelogJson {
  changelog = _.cloneDeep(changelog);
  // for a better snapshot, make the fake commit match if the real commit did
  const fakeCommits: { [commit: string]: string } = {};
  let fakeHashNum = 0;

  for (const entry of changelog.entries) {
    entry.date = '(date)';
    for (const changeType of SortedChangeTypes) {
      if (entry.comments[changeType]) {
        for (const comment of entry.comments[changeType]!) {
          if (!fakeCommits[comment.commit]) {
            fakeCommits[comment.commit] = `(sha1-${fakeHashNum++})`;
          }
          comment.commit = fakeCommits[comment.commit];
        }
      }
    }
  }
  return changelog;
}
