import { ChangelogEntry } from '../types/ChangeLog';
import _ from 'lodash';
import { PackageChangelogRenderInfo, ChangelogRenderers } from '../types/ChangelogOptions';
import { ChangeType } from '../types/ChangeInfo';
import { SortedChangeTypes } from '../changefile/changeTypes';

const groupNames: { [k in ChangeType]: string } = {
  major: 'Major changes',
  premajor: 'Major changes (pre-release)',
  minor: 'Minor changes',
  preminor: 'Minor changes (pre-release)',
  patch: 'Patches',
  prepatch: 'Patches (pre-release)',
  prerelease: 'Changes',
  none: '', // not used
};

// Skip 'none' changes, then order from major down to prerelease
const changeTypeOrder = SortedChangeTypes.slice(1).reverse();

export const defaultRenderers: Required<ChangelogRenderers> = {
  renderHeader: _renderHeader,
  renderChangeTypeSection: _renderChangeTypeSection,
  renderChangeTypeHeader: _renderChangeTypeHeader,
  renderEntries: _renderEntries,
  renderEntry: _renderEntry,
};

export async function renderPackageChangelog(renderInfo: PackageChangelogRenderInfo): Promise<string> {
  const { renderHeader, renderChangeTypeSection } = renderInfo.renderers;

  const sections = [await renderHeader(renderInfo)];

  for (const changeType of changeTypeOrder) {
    const section = await renderChangeTypeSection(changeType, renderInfo);
    if (section) {
      sections.push(section);
    }
  }

  return sections.join('\n\n');
}

function _renderHeader(renderInfo: PackageChangelogRenderInfo): string {
  return `## ${renderInfo.newVersionChangelog.version}\n\n${renderInfo.newVersionChangelog.date.toUTCString()}`;
}

async function _renderChangeTypeSection(
  changeType: ChangeType,
  renderInfo: PackageChangelogRenderInfo
): Promise<string> {
  const { renderChangeTypeHeader, renderEntries } = renderInfo.renderers;
  const entries = renderInfo.newVersionChangelog.comments[changeType];
  return entries && entries.length
    ? `${await renderChangeTypeHeader(changeType, renderInfo)}\n\n${await renderEntries(changeType, renderInfo)}`
    : '';
}

function _renderChangeTypeHeader(changeType: ChangeType): string {
  return `### ${groupNames[changeType]}`;
}

async function _renderEntries(changeType: ChangeType, renderInfo: PackageChangelogRenderInfo): Promise<string> {
  const entries = renderInfo.newVersionChangelog.comments[changeType];
  if (!entries || !entries.length) {
    return '';
  }

  if (renderInfo.isGrouped) {
    const entriesByPackage = _.entries(_.groupBy(entries, entry => entry.package));

    // Use a for loop here (not map) so that if renderEntry does network requests, we don't fire them all at once
    const packagesText: string[] = [];
    for (const [pkgName, pkgEntries] of entriesByPackage) {
      const entriesText = (await _renderEntriesBasic(pkgEntries, renderInfo)).map(entry => `  ${entry}`).join('\n');

      packagesText.push(`- \`${pkgName}\`\n${entriesText}`);
    }
    return packagesText.join('\n');
  }

  return (await _renderEntriesBasic(entries, renderInfo)).join('\n');
}

async function _renderEntriesBasic(
  entries: ChangelogEntry[],
  renderInfo: PackageChangelogRenderInfo
): Promise<string[]> {
  // Use a for loop here (not map) so that if renderEntry does network requests, we don't fire them all at once
  const results: string[] = [];
  for (const entry of entries) {
    results.push(await renderInfo.renderers.renderEntry(entry, renderInfo));
  }
  return results;
}

function _renderEntry(entry: ChangelogEntry): string {
  if (entry.author === 'beachball') {
    return `- ${entry.comment}`;
  }

  return `- ${entry.comment} (${entry.author})`;
}
