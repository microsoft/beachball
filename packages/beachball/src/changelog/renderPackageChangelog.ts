import { PackageChangelog, ChangelogEntry, ChangelogJsonEntry } from '../types/ChangeLog';
import _ from 'lodash';
import { GitHubInfo } from '../types/BeachballOptions';

export interface PackageChangelogRenderOptions {
  changelog: PackageChangelog;
  isGroupedChangelog: boolean;
  previousChangelogEntry: ChangelogJsonEntry | undefined;
  github?: GitHubInfo;
}

export function renderPackageChangelog(options: PackageChangelogRenderOptions): string {
  const { changelog, isGroupedChangelog, previousChangelogEntry, github } = options;
  const header =
    github && changelog.tag
      ? `[${changelog.version}](https://github.com/${github.owner}/${github.repo}/tree/${changelog.tag})`
      : changelog.version;

  let subHeader = changelog.date.toUTCString();
  subHeader +=
    github && previousChangelogEntry?.tag
      ? `\n[Compare changes](https://github.com/${github.owner}/${github.repo}/tree/${previousChangelogEntry?.tag}..${changelog.tag})`
      : '';

  return (
    `\n## ${header}\n` +
    `${subHeader}\n` +
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
