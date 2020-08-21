import { ChangelogEntry } from '../types/ChangeLog';
import _ from 'lodash';
import { PackageChangelogRenderInfo, ChangelogRenderers } from '../types/ChangelogOptions';
import { ChangeType } from '../types/ChangeInfo';

const groupNames: { [k in ChangeType]: string } = {
  major: 'Major changes',
  minor: 'Minor changes',
  patch: 'Patches',
  prerelease: 'Changes',
  none: '', // not used
};

export const defaultRenderers: Required<ChangelogRenderers> = {
  renderHeader: _renderHeader,
  renderChangeTypeSection: _renderChangeTypeSection,
  renderChangeTypeHeader: _renderChangeTypeHeader,
  renderEntries: _renderEntries,
  renderEntry: _renderEntry,
};

export async function renderPackageChangelog(renderInfo: PackageChangelogRenderInfo): Promise<string> {
  const { renderHeader, renderChangeTypeSection } = renderInfo.renderers;
  const versionHeader = await renderHeader(renderInfo);

  return [
    versionHeader,
    await renderChangeTypeSection('major', renderInfo),
    await renderChangeTypeSection('minor', renderInfo),
    await renderChangeTypeSection('patch', renderInfo),
    await renderChangeTypeSection('prerelease', renderInfo),
  ]
    .filter(Boolean)
    .join('\n\n');
}

async function _renderHeader(renderInfo: PackageChangelogRenderInfo): Promise<string> {
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

async function _renderChangeTypeHeader(
  changeType: ChangeType,
  renderInfo: PackageChangelogRenderInfo
): Promise<string> {
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
    let packagesText: string[] = [];
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
  let results: string[] = [];
  for (const entry of entries) {
    results.push(await renderInfo.renderers.renderEntry(entry, renderInfo));
  }
  return results;
}

async function _renderEntry(entry: ChangelogEntry, renderInfo: PackageChangelogRenderInfo): Promise<string> {
  return `- ${entry.comment} (${entry.author})`;
}
