import { PackageChangelog } from '../types/ChangeLog';
import { renderPackageChangelog, defaultRenderers } from './renderPackageChangelog';
import { ChangelogOptions, PackageChangelogRenderInfo } from '../types/ChangelogOptions';

export interface MarkdownChangelogRenderOptions extends Omit<PackageChangelogRenderInfo, 'renderers'> {
  previousContent: string;
  changelogOptions: ChangelogOptions;
}

export function renderChangelog(renderOptions: MarkdownChangelogRenderOptions): string {
  const {
    previousJson,
    previousContent,
    newVersionChangelog,
    isGrouped,
    changelogOptions: { renderPackageChangelog: customRenderPackageChangelog, customRenderers },
  } = renderOptions;

  const previousLogEntries = previousContent ? previousContent.substring(previousContent.indexOf('##')) : '';

  try {
    if (customRenderPackageChangelog || customRenderers) {
      console.log('Using custom renderer for package version changelog.');
    }

    const renderInfo: PackageChangelogRenderInfo = {
      previousJson,
      newVersionChangelog,
      isGrouped,
      renderers: {
        ...defaultRenderers,
        ...customRenderers,
      },
    };

    return (
      [
        renderChangelogHeader(newVersionChangelog),
        (customRenderPackageChangelog || renderPackageChangelog)(renderInfo),
        previousLogEntries,
      ]
        .join('\n\n')
        .trim() + '\n'
    );
  } catch (err) {
    console.log('Error occurred rendering package version changelog:', err);
    return '';
  }
}

function renderChangelogHeader(changelog: PackageChangelog): string {
  return (
    `# Change Log - ${changelog.name}\n\n` +
    `This log was last generated on ${changelog.date.toUTCString()} and should not be manually modified.`
  );
}
