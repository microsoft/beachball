import { renderPackageChangelog, PackageChangelogRenderOptions } from './renderPackageChangelog';

export interface ChangelogRenderOptions extends PackageChangelogRenderOptions {
  previousContent: string;
}

export function renderChangelog(options: ChangelogRenderOptions): string {
  const { previousContent, changelog } = options;
  const previousLogEntries = previousContent ? '\n' + previousContent.substring(previousContent.indexOf('##')) : '';
  return (
    `# Change Log - ${changelog.name}\n\n` +
    `This log was last generated on ${changelog.date.toUTCString()} and should not be manually modified.\n` +
    renderPackageChangelog(options) +
    previousLogEntries
  );
}
