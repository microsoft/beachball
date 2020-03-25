import { PackageChangelog, ChangelogEntry } from '../types/ChangeLog';
import _ from 'lodash';

export function renderPackageChangelog(changelog: PackageChangelog, isGroupedChangelog: boolean = false) {
  return (
    `\n## ${changelog.version}\n` +
    `${changelog.date.toUTCString()}\n` +
    (changelog.comments.major
      ? '\n### Major\n\n' + renderChangelogEntries(changelog.comments.major, isGroupedChangelog)
      : '') +
    (changelog.comments.minor
      ? '\n### Minor changes\n\n' + renderChangelogEntries(changelog.comments.minor, isGroupedChangelog)
      : '') +
    (changelog.comments.patch
      ? '\n### Patches\n\n' + renderChangelogEntries(changelog.comments.patch, isGroupedChangelog)
      : '') +
    (changelog.comments.prerelease
      ? '\n### Changes\n\n' + renderChangelogEntries(changelog.comments.prerelease, isGroupedChangelog)
      : '')
  );
}

function renderChangelogEntries(entries: ChangelogEntry[], includePackageInfo: boolean = false): string {
  if (includePackageInfo) {
    const entriesMap = _.groupBy(entries, entry => entry.package);

    let result = '';
    Object.keys(entriesMap).forEach(pkgName => {
      const entries = entriesMap[pkgName];
      result += `- \`${pkgName}\`\n`;
      entries.forEach(entry => {
        result += `  - ${entry.comment} (${entry.author})\n`;
      });
    });

    return result;
  }

  return entries
    .map(entry => {
      return `- ${entry.comment} (${entry.author})`;
    })
    .join('\n');
}
