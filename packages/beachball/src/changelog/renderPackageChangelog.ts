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
  return `## ${renderInfo.newEntry.version}\n${renderInfo.newEntry.date.toUTCString()}`;
}

function _renderChangeTypeSection(changeType: ChangeType, renderInfo: PackageChangelogRenderInfo): string {
  const { renderChangeTypeHeader } = renderInfo.renderers;
  const entries = renderInfo.newEntry.comments[changeType];
  return entries
    ? `${renderChangeTypeHeader(changeType, renderInfo)}\n\n${_renderChangelogEntries(entries, renderInfo)}`
    : '';
}

function _renderChangeTypeHeader(changeType: ChangeType, renderInfo: PackageChangelogRenderInfo): string {
  return `### ${groupNames[changeType]}`;
}

function _renderChangelogEntries(entries: ChangelogEntry[], renderInfo: PackageChangelogRenderInfo): string {
  const { renderEntry } = renderInfo.renderers;
  if (renderInfo.isGrouped) {
    const entriesMap = _.groupBy(entries, entry => entry.package);

    let result = '';
    Object.keys(entriesMap).forEach(pkgName => {
      const entries = entriesMap[pkgName];
      result += `- \`${pkgName}\`\n`;
      entries.forEach(entry => {
        result += `  ${renderEntry(entry, renderInfo)}\n`;
      });
    });

    return result;
  }

  return entries.map(entry => renderEntry(entry, renderInfo)).join('\n');
}

function _renderEntry(entry: ChangelogEntry, renderInfo: PackageChangelogRenderInfo): string {
  return `- ${entry.comment} (${entry.author})`;
}
