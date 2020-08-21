import { PackageChangelogRenderInfo } from '../../types/ChangelogOptions';
import { defaultRenderers, renderPackageChangelog } from '../../changelog/renderPackageChangelog';

const { renderEntry, renderEntries, renderChangeTypeHeader, renderChangeTypeSection, renderHeader } = defaultRenderers;

const leadingNewlineRegex = /^\n/;
const trailingNewlineRegex = /\n$/;

describe('changelog renderers -', () => {
  function getRenderInfo(): PackageChangelogRenderInfo {
    return {
      isGrouped: false,
      newVersionChangelog: {
        date: new Date('Thu Aug 22 2019 14:20:40 GMT-0700 (Pacific Daylight Time)'),
        name: 'foo',
        tag: 'foo_v1.2.3',
        version: '1.2.3',
        comments: {
          major: [],
          minor: [
            { comment: 'Awesome change', author: 'user1@example.com', commit: 'sha1', package: 'foo' },
            { comment: 'Boring change', author: 'user2@example.com', commit: 'sha2', package: 'foo' },
          ],
          patch: [
            { comment: 'Fix', author: 'user1@example.com', commit: 'sha3', package: 'foo' },
            { comment: 'stuff', author: 'user2@example.com', commit: 'sha4', package: 'foo' },
          ],
        },
      },
      previousJson: {} as any,
      renderers: { ...defaultRenderers }, // copy in case of modification
    };
  }

  function getGroupedRenderInfo(): PackageChangelogRenderInfo {
    const renderInfo = getRenderInfo();
    renderInfo.isGrouped = true;
    renderInfo.newVersionChangelog.comments.minor![0].package = 'bar';
    renderInfo.newVersionChangelog.comments.patch![1].package = 'bar';
    return renderInfo;
  }

  function doBasicTests(result: string) {
    expect(result).not.toMatch(leadingNewlineRegex);
    expect(result).not.toMatch(trailingNewlineRegex);
    expect(result).toMatchSnapshot();
  }

  describe('renderEntry', () => {
    it('has correct output', async () => {
      const renderInfo = getRenderInfo();
      const result = await renderEntry(renderInfo.newVersionChangelog.comments.minor![0], renderInfo);
      doBasicTests(result);
    });

    it('has correct grouped output', async () => {
      const renderInfo = getGroupedRenderInfo();
      const result = await renderEntry(renderInfo.newVersionChangelog.comments.minor![0], renderInfo);
      doBasicTests(result);
    });
  });

  describe('renderEntries', () => {
    it('has correct output', async () => {
      const renderInfo = getRenderInfo();
      const result = await renderEntries('minor', renderInfo);
      doBasicTests(result);
    });

    it('has correct grouped output', async () => {
      const renderInfo = getGroupedRenderInfo();
      const result = await renderEntries('minor', renderInfo);
      doBasicTests(result);
    });
  });

  describe('renderChangeTypeHeader', () => {
    it('has correct output', async () => {
      const renderInfo = getRenderInfo();
      const result = await renderChangeTypeHeader('minor', renderInfo);
      doBasicTests(result);
    });

    it('has correct grouped output', async () => {
      const renderInfo = getGroupedRenderInfo();
      const result = await renderChangeTypeHeader('minor', renderInfo);
      doBasicTests(result);
    });
  });

  describe('renderChangeTypeSection', () => {
    it('has correct output', async () => {
      const renderInfo = getRenderInfo();
      const result = await renderChangeTypeSection('minor', renderInfo);
      doBasicTests(result);
    });

    it('has correct grouped output', async () => {
      const renderInfo = getGroupedRenderInfo();
      const result = await renderChangeTypeSection('minor', renderInfo);
      doBasicTests(result);
    });
  });

  describe('renderHeader', () => {
    it('has correct output', async () => {
      const renderInfo = getRenderInfo();
      const result = await renderHeader(renderInfo);
      doBasicTests(result);
    });

    it('has correct grouped output', async () => {
      const renderInfo = getGroupedRenderInfo();
      const result = await renderHeader(renderInfo);
      doBasicTests(result);
    });
  });

  describe('renderPackageChangelog', () => {
    it('has correct output', async () => {
      const renderInfo = getRenderInfo();
      const result = await renderPackageChangelog(renderInfo);
      doBasicTests(result);
    });

    it('has correct grouped output', async () => {
      const renderInfo = getGroupedRenderInfo();
      const result = await renderPackageChangelog(renderInfo);
      doBasicTests(result);
    });

    it('uses custom renderEntry', async () => {
      const renderInfo = getGroupedRenderInfo();
      renderInfo.renderers.renderEntry = async (entry, renderInfo) => `- ${entry.comment} (#123)`;

      const result = await renderPackageChangelog(renderInfo);
      expect(result).toContain('#123');
      expect(result).toMatchSnapshot();
    });

    it('uses custom renderEntries', async () => {
      const renderInfo = getRenderInfo();
      renderInfo.renderers.renderEntries = async (changeType, renderInfo) => {
        const entries = renderInfo.newVersionChangelog.comments[changeType];
        return entries ? entries.map(entry => `${entry.comment}!!!`).join('\n\n') : '';
      };

      const result = await renderPackageChangelog(renderInfo);
      expect(result).toContain('!!!');
      expect(result).toMatchSnapshot();
    });

    it('uses custom renderChangeTypeHeader', async () => {
      const renderInfo = getRenderInfo();
      renderInfo.renderers.renderChangeTypeHeader = async (changeType, renderInfo) =>
        changeType === 'minor' || changeType === 'major' ? '### Important stuff' : '### Boring stuff';

      const result = await renderPackageChangelog(renderInfo);
      expect(result).toContain('### Important stuff');
      expect(result).toMatchSnapshot();
    });

    it('uses custom renderChangeTypeSection', async () => {
      const renderInfo = getRenderInfo();
      renderInfo.renderers.renderChangeTypeSection = async (changeType, renderInfo) =>
        changeType === 'minor' || changeType === 'major' ? renderChangeTypeSection(changeType, renderInfo) : '';

      const result = await renderPackageChangelog(renderInfo);
      expect(result).not.toContain('Patches');
      expect(result).toMatchSnapshot();
    });

    it('uses custom renderHeader', async () => {
      const renderInfo = getRenderInfo();
      renderInfo.renderers.renderHeader = async renderInfo =>
        [
          `## ${renderInfo.newVersionChangelog.version}`,
          renderInfo.newVersionChangelog.date.toUTCString(),
          `[Compare changes](http://real-github-compare-link)`,
        ].join('\n');

      const result = await renderPackageChangelog(renderInfo);
      expect(result).toContain('Compare changes');
      expect(result).toMatchSnapshot();
    });
  });
});
