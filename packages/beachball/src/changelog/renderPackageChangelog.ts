import { ChangelogEntry } from '../types/Changelog';
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

export function renderPackageChangelog(renderInfo: PackageChangelogRenderInfo) {
  const { renderHeader, renderChangeTypeSection } = renderInfo.renderers;
  const versionHeader = renderHeader(renderInfo);

  return [
    versionHeader,
    renderChangeTypeSection('major', renderInfo),
    renderChangeTypeSection('minor', renderInfo),
    renderChangeTypeSection('patch', renderInfo),
    renderChangeTypeSection('prerelease', renderInfo),
  ]
    .filter(Boolean)
    .join('\n\n');
}

function _renderHeader(renderInfo: PackageChangelogRenderInfo): string {
  return `## ${renderInfo.newVersionChangelog.version}\n\n${renderInfo.newVersionChangelog.date.toUTCString()}`;
}

function _renderChangeTypeSection(changeType: ChangeType, renderInfo: PackageChangelogRenderInfo): string {
  const { renderChangeTypeHeader, renderEntries } = renderInfo.renderers;
  const entries = renderInfo.newVersionChangelog.comments[changeType];
  return entries && entries.length
    ? `${renderChangeTypeHeader(changeType, renderInfo)}\n\n${renderEntries(changeType, renderInfo)}`
    : '';
}

function _renderChangeTypeHeader(changeType: ChangeType, renderInfo: PackageChangelogRenderInfo): string {
  return `### ${groupNames[changeType]}`;
}

function _renderEntries(changeType: ChangeType, renderInfo: PackageChangelogRenderInfo): string {
  const entries = renderInfo.newVersionChangelog.comments[changeType];
  if (!entries || !entries.length) {
    return '';
  }
  const { renderEntry } = renderInfo.renderers;
  if (renderInfo.isGrouped) {
    const entriesMap = _.groupBy(entries, entry => entry.package);

    return Object.keys(entriesMap)
      .map(pkgName => {
        const entriesText = entriesMap[pkgName].map(entry => `  ${renderEntry(entry, renderInfo)}`).join('\n');
        return `- \`${pkgName}\`\n${entriesText}`;
      })
      .join('\n');
  }

  return entries.map(entry => renderEntry(entry, renderInfo)).join('\n');
}

function _renderEntry(entry: ChangelogEntry, renderInfo: PackageChangelogRenderInfo): string {
  return `- ${entry.comment} (${entry.author})`;
}
