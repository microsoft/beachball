import { PackageChangelog, ChangelogEntry } from '../types/ChangeLog';

export function renderPackageChangelog(changelog: PackageChangelog, isGroupedChangelog: boolean = false) {
  return (
    `\n## ${changelog.version}\n` +
    `${changelog.date.toUTCString()}\n` +
    (changelog.comments.major
      ? '\n### Major\n\n' +
        changelog.comments.major.map(change => renderChangelogEntry(change, isGroupedChangelog)).join('\n')
      : '') +
    (changelog.comments.minor
      ? '\n### Minor changes\n\n' +
        changelog.comments.minor.map(change => renderChangelogEntry(change, isGroupedChangelog)).join('\n')
      : '') +
    (changelog.comments.patch
      ? '\n### Patches\n\n' +
        changelog.comments.patch.map(change => renderChangelogEntry(change, isGroupedChangelog)).join('\n')
      : '') +
    (changelog.comments.prerelease
      ? '\n### Changes\n\n' +
        changelog.comments.prerelease.map(change => renderChangelogEntry(change, isGroupedChangelog)).join('\n')
      : '')
  );
}

function renderChangelogEntry(entry: ChangelogEntry, includePackageInfo: boolean = false): string {
  if (includePackageInfo && entry.package.name) {
    return `- \`${entry.package.name}\`\n  - ${entry.comment} (${entry.author})`;
  }

  return `- ${entry.comment} (${entry.author})`;
}
