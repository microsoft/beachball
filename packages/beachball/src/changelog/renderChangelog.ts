import { PackageChangelog } from '../types/ChangeLog';
import { renderPackageChangelog as defaultRenderPackageChangelog } from './renderPackageChangelog';

export interface MarkdownChangelogRenderOptions {
  exisingContent: string;
  packageChangelog: PackageChangelog;
  isGroupedChangelog: boolean;
  renderPackageChangelog?: () => string;
}

export function renderChangelog(renderOptions: MarkdownChangelogRenderOptions): string {
  const { exisingContent, packageChangelog, isGroupedChangelog, renderPackageChangelog } = renderOptions;
  const previousLogEntries = exisingContent ? '\n' + exisingContent.substring(exisingContent.indexOf('##')) : '';

  const packageChangelogContent = renderPackageChangelog
    ? renderPackageChangelog()
    : defaultRenderPackageChangelog(packageChangelog, isGroupedChangelog);

  return renderChangelogHeader(packageChangelog) + packageChangelogContent + previousLogEntries;
}

function renderChangelogHeader(changelog: PackageChangelog): string {
  return (
    `# Change Log - ${changelog.name}\n\n` +
    `This log was last generated on ${changelog.date.toUTCString()} and should not be manually modified.\n`
  );
}
