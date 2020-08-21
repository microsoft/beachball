import { generateTag } from '../tag';
import { PackageChangelog, ChangelogJson, ChangelogJsonEntry } from '../types/ChangeLog';

export function renderJsonChangelog(changelog: PackageChangelog, previousChangelog: ChangelogJson | undefined) {
  const result: ChangelogJson = {
    name: changelog.name,
    entries: previousChangelog?.entries ? [...previousChangelog.entries] : [],
  };
  const newEntry: ChangelogJsonEntry = {
    date: changelog.date.toUTCString(),
    tag: generateTag(changelog.name, changelog.version),
    version: changelog.version,
    comments: changelog.comments,
  };
  result.entries.unshift(newEntry);
  return result;
}
