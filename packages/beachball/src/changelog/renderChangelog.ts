import { PackageChangelog } from '../types/ChangeLog';
import { renderPackageChangelog } from './renderPackageChangelog';
export function renderChangelog(previous: string, changelog: PackageChangelog) {
  const previousLogEntries = previous ? '\n' + previous.substring(previous.indexOf('##')) : '';
  return (`# Change Log - ${changelog.name}\n\n` +
    `This log was last generated on ${changelog.date.toUTCString()} and should not be manually modified.\n` +
    renderPackageChangelog(changelog) +
    previousLogEntries);
}
