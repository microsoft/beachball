import { describe, expect, it } from '@jest/globals';
import type { PackageChangelogRenderInfo } from '../../types/ChangelogOptions';
import { defaultRenderers, renderPackageChangelog } from '../../changelog/renderPackageChangelog';
import type { ChangelogEntry, ChangelogJson } from '../../types/ChangeLog';
import { SortedChangeTypes } from '../../changefile/changeTypes';

const { renderEntry, renderEntries, renderChangeTypeHeader, renderChangeTypeSection, renderHeader } = defaultRenderers;

const leadingTrailingNewlineRegex = /^\n|\n$/;

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
      previousJson: {} as ChangelogJson,
      renderers: { ...defaultRenderers }, // copy in case of modification
      defaultRenderers,
    };
  }

  function getChangelogEntry(entry: Partial<ChangelogEntry>): ChangelogEntry {
    return {
      comment: 'comment',
      author: 'user1@example.com',
      commit: 'sha1',
      package: 'foo',
      ...entry,
    };
  }

  function getGroupedRenderInfo(): PackageChangelogRenderInfo {
    const renderInfo = getRenderInfo();
    renderInfo.isGrouped = true;
    renderInfo.newVersionChangelog.comments.minor![0].package = 'bar';
    renderInfo.newVersionChangelog.comments.patch![1].package = 'bar';
    return renderInfo;
  }

  describe('renderEntry', () => {
    it('has correct output', async () => {
      const renderInfo = getRenderInfo();
      const result = await renderEntry(renderInfo.newVersionChangelog.comments.minor![0], renderInfo);
      expect(result).not.toMatch(leadingTrailingNewlineRegex);
      expect(result).toMatchInlineSnapshot(`"- Awesome change (user1@example.com)"`);
    });

    it('has correct grouped output', async () => {
      const renderInfo = getGroupedRenderInfo();
      const result = await renderEntry(renderInfo.newVersionChangelog.comments.minor![0], renderInfo);
      expect(result).not.toMatch(leadingTrailingNewlineRegex);
      expect(result).toMatchInlineSnapshot(`"- Awesome change (user1@example.com)"`);
    });

    it('escapes < outside of code blocks', async () => {
      const renderInfo = getRenderInfo();
      renderInfo.newVersionChangelog.comments.minor![0].comment = 'Add --config <file>';
      const result = await renderEntry(renderInfo.newVersionChangelog.comments.minor![0], renderInfo);
      expect(result).toMatchInlineSnapshot(`"- Add --config \\<file> (user1@example.com)"`);
    });

    it('does not escape < inside code blocks', async () => {
      const renderInfo = getRenderInfo();
      renderInfo.newVersionChangelog.comments.minor![0].comment = 'Add `--config <file>`';
      const result = await renderEntry(renderInfo.newVersionChangelog.comments.minor![0], renderInfo);
      expect(result).toMatchInlineSnapshot(`"- Add \`--config <file>\` (user1@example.com)"`);
    });
  });

  describe('renderEntries', () => {
    it('has correct output', async () => {
      const renderInfo = getRenderInfo();
      const result = await renderEntries('minor', renderInfo);
      expect(result).not.toMatch(leadingTrailingNewlineRegex);
      expect(result).toMatchInlineSnapshot(`
        "- Awesome change (user1@example.com)
        - Boring change (user2@example.com)"
      `);
    });

    it('has correct grouped output', async () => {
      const renderInfo = getGroupedRenderInfo();
      const result = await renderEntries('minor', renderInfo);
      expect(result).not.toMatch(leadingTrailingNewlineRegex);
      expect(result).toMatchInlineSnapshot(`
        "- \`bar\`
          - Awesome change (user1@example.com)
        - \`foo\`
          - Boring change (user2@example.com)"
      `);
    });
  });

  describe('renderChangeTypeHeader', () => {
    it('has correct output', async () => {
      const renderInfo = getRenderInfo();
      const result = await renderChangeTypeHeader('minor', renderInfo);
      expect(result).not.toMatch(leadingTrailingNewlineRegex);
      expect(result).toMatchInlineSnapshot(`"### Minor changes"`);
    });

    it('has correct grouped output', async () => {
      const renderInfo = getGroupedRenderInfo();
      const result = await renderChangeTypeHeader('minor', renderInfo);
      expect(result).not.toMatch(leadingTrailingNewlineRegex);
      expect(result).toMatchInlineSnapshot(`"### Minor changes"`);
    });
  });

  describe('renderChangeTypeSection', () => {
    it('has correct output', async () => {
      const renderInfo = getRenderInfo();
      const result = await renderChangeTypeSection('minor', renderInfo);
      expect(result).not.toMatch(leadingTrailingNewlineRegex);
      expect(result).toMatchInlineSnapshot(`
        "### Minor changes

        - Awesome change (user1@example.com)
        - Boring change (user2@example.com)"
      `);
    });

    it('has correct grouped output', async () => {
      const renderInfo = getGroupedRenderInfo();
      const result = await renderChangeTypeSection('minor', renderInfo);
      expect(result).not.toMatch(leadingTrailingNewlineRegex);
      expect(result).toMatchInlineSnapshot(`
        "### Minor changes

        - \`bar\`
          - Awesome change (user1@example.com)
        - \`foo\`
          - Boring change (user2@example.com)"
      `);
    });
  });

  describe('renderHeader', () => {
    it('has correct output', async () => {
      const renderInfo = getRenderInfo();
      const result = await renderHeader(renderInfo);
      expect(result).not.toMatch(leadingTrailingNewlineRegex);
      expect(result).toMatchInlineSnapshot(`
        "## 1.2.3

        Thu, 22 Aug 2019 21:20:40 GMT"
      `);
    });

    it('has correct grouped output', async () => {
      const renderInfo = getGroupedRenderInfo();
      const result = await renderHeader(renderInfo);
      expect(result).not.toMatch(leadingTrailingNewlineRegex);
      expect(result).toMatchInlineSnapshot(`
        "## 1.2.3

        Thu, 22 Aug 2019 21:20:40 GMT"
      `);
    });
  });

  describe('renderPackageChangelog', () => {
    it('has correct output', async () => {
      const renderInfo = getRenderInfo();
      const result = await renderPackageChangelog(renderInfo);
      expect(result).not.toMatch(leadingTrailingNewlineRegex);
      // Most of the package output snapshots go in a snapshot file since they're longer,
      // but include one inline to help as a sanity check.
      expect(result).toMatchInlineSnapshot(`
        "## 1.2.3

        Thu, 22 Aug 2019 21:20:40 GMT

        ### Minor changes

        - Awesome change (user1@example.com)
        - Boring change (user2@example.com)

        ### Patches

        - Fix (user1@example.com)
        - stuff (user2@example.com)"
      `);
    });

    it('includes all change types', async () => {
      const renderInfo = getRenderInfo();
      renderInfo.newVersionChangelog.comments = Object.fromEntries(
        SortedChangeTypes.map(type => [type, [getChangelogEntry({ comment: `${type} change` })]])
      );
      const result = await renderPackageChangelog(renderInfo);
      // a couple explicit tests
      expect(result).not.toContain('none change');
      for (const type of SortedChangeTypes) {
        if (type !== 'none') {
          expect(result).toContain(`${type} change`);
        }
      }
      expect(result).not.toMatch(leadingTrailingNewlineRegex);
      expect(result).toMatchSnapshot();
    });

    it('has correct grouped output', async () => {
      const renderInfo = getGroupedRenderInfo();
      const result = await renderPackageChangelog(renderInfo);
      expect(result).not.toMatch(leadingTrailingNewlineRegex);
      expect(result).toMatchSnapshot();
    });

    it('uses custom renderEntry', async () => {
      const renderInfo = getGroupedRenderInfo();
      renderInfo.renderers.renderEntry = entry => `- ${entry.comment} (#123)`;

      const result = await renderPackageChangelog(renderInfo);
      expect(result).toContain('#123');
      expect(result).toMatchSnapshot();
    });

    it('uses custom renderEntries', async () => {
      const renderInfo = getRenderInfo();
      renderInfo.renderers.renderEntries = (changeType, info) => {
        const entries = info.newVersionChangelog.comments[changeType];
        return entries ? entries.map(entry => `${entry.comment}!!!`).join('\n\n') : '';
      };

      const result = await renderPackageChangelog(renderInfo);
      expect(result).toContain('!!!');
      expect(result).toMatchSnapshot();
    });

    it('uses custom renderChangeTypeHeader', async () => {
      const renderInfo = getRenderInfo();
      renderInfo.renderers.renderChangeTypeHeader = changeType =>
        changeType === 'minor' || changeType === 'major' ? '### Important stuff' : '### Boring stuff';

      const result = await renderPackageChangelog(renderInfo);
      expect(result).toContain('### Important stuff');
      expect(result).toMatchSnapshot();
    });

    it('uses custom renderChangeTypeSection', async () => {
      const renderInfo = getRenderInfo();
      renderInfo.renderers.renderChangeTypeSection = async (changeType, info) =>
        changeType === 'minor' || changeType === 'major' ? renderChangeTypeSection(changeType, info) : '';

      const result = await renderPackageChangelog(renderInfo);
      expect(result).not.toContain('Patches');
      expect(result).toMatchSnapshot();
    });

    it('uses custom renderHeader', async () => {
      const renderInfo = getRenderInfo();
      renderInfo.renderers.renderHeader = info =>
        [
          `## ${info.newVersionChangelog.version}`,
          renderInfo.newVersionChangelog.date.toUTCString(),
          `[Compare changes](http://real-github-compare-link)`,
        ].join('\n');

      const result = await renderPackageChangelog(renderInfo);
      expect(result).toContain('Compare changes');
      expect(result).toMatchSnapshot();
    });
  });
});
