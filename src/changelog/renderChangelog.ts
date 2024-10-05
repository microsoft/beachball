import { renderPackageChangelog, defaultRenderers } from './renderPackageChangelog';
import { renderMainHeader } from './renderMainHeader';
import { ChangelogOptions, PackageChangelogRenderInfo } from '../types/ChangelogOptions';

export interface MarkdownChangelogRenderOptions extends Omit<PackageChangelogRenderInfo, 'renderers'> {
  previousContent: string;
  changelogOptions: ChangelogOptions;
}

/** Comment dividing the generated header content and the package version changelog entries */
export const markerComment = '<!-- Start content -->';

/** Note indicating that the changelog has been truncated */
export const trimmedVersionsNote = '**Changelog has been truncated. Refer to git history for older versions.**';

let loggedCustomRender = false;

export async function renderChangelog(renderOptions: MarkdownChangelogRenderOptions): Promise<string> {
  const {
    previousJson,
    previousContent = '',
    newVersionChangelog,
    isGrouped,
    changelogOptions: {
      renderPackageChangelog: customRenderPackageChangelog,
      customRenderers,
      renderMainHeader: customRenderMainHeader,
      maxVersions,
    },
  } = renderOptions;

  // Figure out where the previous log entries (not the main header) started based on the marker comment.
  // (The end of the previous entries might be trimmed later based on the maxVersions option.)
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
      !loggedCustomRender && console.log('Using custom renderer for package version changelog.');
      loggedCustomRender = true;
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

    const packageChangelog = await (customRenderPackageChangelog || renderPackageChangelog)(renderInfo);

    if (maxVersions) {
      previousLogEntries = _trimPreviousLog({ packageChangelog, previousLogEntries, maxVersions });
    }

    return (
      [
        await (customRenderMainHeader || renderMainHeader)(newVersionChangelog),
        `<!-- This log was last generated on ${newVersionChangelog.date.toUTCString()} and should not be manually modified. -->`,
        markerComment,
        packageChangelog,
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

/**
 * Trim the previous changelog entries if over the threshold.
 *
 * (exported for testing only)
 */
export function _trimPreviousLog(params: {
  packageChangelog: string;
  previousLogEntries: string;
  maxVersions: number;
}): string {
  const { packageChangelog, previousLogEntries, maxVersions } = params;

  // Find a markdown header prefix which will be used to split the entries
  const headerPrefix = packageChangelog.match(/^#+ /m)?.[0];
  if (!headerPrefix) {
    // This could happen if someone has a custom renderer that doesn't start entries with a markdown header
    console.warn(
      `Changelog truncation to ${maxVersions} entries was requested, but the header format is not recognized.`
    );
    return previousLogEntries;
  }

  // Iterate through finding the next header and counting the number of versions
  let count = 0;
  // We need to use a regexp anchored to the line start to avoid matching lower level headers
  // (e.g. if the header prefix is '## ', we don't want to match a substring of '### ').
  let headerRegexp = new RegExp(`^${headerPrefix}`, 'gm');
  let lastMatch: RegExpExecArray | null = null;
  while (count < maxVersions && (lastMatch = headerRegexp.exec(previousLogEntries))) {
    count++;
  }

  // If there are too many versions (counting the new one), trim the entries and add a note
  if (count >= maxVersions && lastMatch) {
    return previousLogEntries.substring(0, lastMatch.index).trim() + '\n\n' + trimmedVersionsNote;
  }

  return previousLogEntries;
}
