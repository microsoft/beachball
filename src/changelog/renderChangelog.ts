import { renderPackageChangelog, defaultRenderers } from './renderPackageChangelog';
import { ChangelogOptions, PackageChangelogRenderInfo } from '../types/ChangelogOptions';

export interface MarkdownChangelogRenderOptions extends Omit<PackageChangelogRenderInfo, 'renderers'> {
  previousContent: string;
  changelogOptions: ChangelogOptions;
}

export const markerComment = '<!-- Start content -->';

export async function renderChangelog(renderOptions: MarkdownChangelogRenderOptions): Promise<string> {
  const {
    previousJson,
    previousContent = '',
    newVersionChangelog,
    isGrouped,
    changelogOptions: { renderPackageChangelog: customRenderPackageChangelog, customRenderers },
  } = renderOptions;

  let previousLogEntries: string;
  if (previousContent.includes(markerComment)) {
    // Preferably determine where the previous entries start based on a special comment
    previousLogEntries = previousContent.split(markerComment, 2)[1].trim();
  } else {
    // Otherwise look for an h2 (used as version header with default renderer).
    // If that's not present, preserve the previous content as-is.
    const h2Match = previousContent.match(/^## /m);
    previousLogEntries = h2Match ? previousContent.substring(h2Match.index!) : previousContent;
  }

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
        `# Change Log - ${newVersionChangelog.name}`,
        `<!-- This log was last generated on ${newVersionChangelog.date.toUTCString()} and should not be manually modified. -->`,
        markerComment,
        await (customRenderPackageChangelog || renderPackageChangelog)(renderInfo),
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
