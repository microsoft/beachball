import { PackageChangelog } from '../types/Changelog';
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
    newEntry,
    isGrouped,
    changelogOptions: { renderPackageChangelog: customRenderPackageChangelog, customRenderers = {} },
  } = renderOptions;

  const previousLogEntries = previousContent ? previousContent.substring(previousContent.indexOf('##')) : '';

  try {
    if (customRenderPackageChangelog || customRenderers) {
      console.log('Using custom renderer for package version changelog.');
    }

    const renderInfo: PackageChangelogRenderInfo = {
      previousJson,
      newEntry,
      isGrouped,
      renderers: {
        ...defaultRenderers,
        ...customRenderers,
      },
    };
    const packageChangelogContent = (customRenderPackageChangelog || renderPackageChangelog)(renderInfo);

    return [renderChangelogHeader(newEntry), packageChangelogContent, previousLogEntries].join('\n\n');
  } catch (err) {
    console.log('Error occurred rendering package version changelog:', err);
    return '';
  }
}

function renderChangelogHeader(changelog: PackageChangelog): string {
  return (
    `# Change Log - ${changelog.name}\n\n` +
    `This log was last generated on ${changelog.date.toUTCString()} and should not be manually modified.\n`
  );
}
