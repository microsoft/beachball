import { PackageChangelog } from '../types/ChangeLog';
export function renderPackageChangelog(changelog: PackageChangelog) {
  return (`\n## ${changelog.version}\n` +
    `${changelog.date.toUTCString()}\n` +
    (changelog.comments.major
      ? '\n### Major\n\n' + changelog.comments.major.map(change => `- ${change.comment} (${change.author})`).join('\n')
      : '') +
    (changelog.comments.minor
      ? '\n### Minor changes\n\n' +
      changelog.comments.minor.map(change => `- ${change.comment} (${change.author})`).join('\n')
      : '') +
    (changelog.comments.patch
      ? '\n### Patches\n\n' +
      changelog.comments.patch.map(change => `- ${change.comment} (${change.author})`).join('\n')
      : '') +
    (changelog.comments.prerelease
      ? '\n### Changes\n\n' +
      changelog.comments.prerelease.map(change => `- ${change.comment} (${change.author})`).join('\n')
      : ''));
}
