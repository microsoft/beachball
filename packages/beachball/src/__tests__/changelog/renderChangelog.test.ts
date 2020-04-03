import { MarkdownChangelogRenderOptions, renderChangelog, markerComment } from '../../changelog/renderChangelog';

const previousHeader = `# Change Log - foo

This log was last generated on Wed, 21 Aug 2019 21:20:40 GMT and should not be manually modified.`;

const previousVersion = `## 1.2.0

(content here)
`;

describe('renderChangelog', () => {
  function getOptions(): MarkdownChangelogRenderOptions {
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
      previousContent: [previousHeader, markerComment, previousVersion].join('\n\n'),
      previousJson: {} as any,
      changelogOptions: {},
    };
  }

  it('handles no previous content', async () => {
    const options = getOptions();
    options.previousContent = '';
    expect(await renderChangelog(options)).toMatchSnapshot();
  });

  it('merges with previous content using marker', async () => {
    const options = getOptions();
    const result = await renderChangelog(options);
    expect(result).toContain('last generated on Thu, 22 Aug 2019 21:20:40 GMT'); // uses new date
    expect(result).toContain(markerComment);
    expect(result.match(new RegExp(markerComment, 'g'))).toHaveLength(1); // old marker comment removed
    expect(result).toMatchSnapshot();
  });

  it('merges with previous content using h2', async () => {
    const options = getOptions();
    options.previousContent = [previousHeader, previousVersion].join('\n\n');
    const result = await renderChangelog(options);
    expect(result).toContain('last generated on Thu, 22 Aug 2019 21:20:40 GMT'); // uses new date
    expect(result).toContain(markerComment);
    expect(result).toMatchSnapshot();
  });

  it('keeps previous content if no marker or h2 is found', async () => {
    const options = getOptions();
    options.previousContent = previousHeader;
    const result = await renderChangelog(options);
    expect(result).toContain('last generated on Thu, 22 Aug 2019 21:20:40 GMT'); // uses new date
    // keeps the old content in case it's relevant--even though it doesn't make sense in this case
    expect(result).toContain('Wed, 21 Aug 2019 21:20:40 GMT');
    expect(result.match(/# Change Log - foo/g)).toHaveLength(2);
    expect(result).toMatchSnapshot();
  });

  it('merges default and custom renderers', async () => {
    const options = getOptions();
    options.changelogOptions.customRenderers = {
      renderHeader: async renderInfo => {
        return [
          `## ${renderInfo.newVersionChangelog.version}`,
          renderInfo.newVersionChangelog.date.toUTCString(),
          `[Compare changes](http://real-github-compare-link)`,
        ].join('\n');
      },
      renderEntry: async (entry, renderInfo) => `- ${entry.comment} (${entry.author}, PR #123)`,
    };

    const result = await renderChangelog(options);
    expect(result).toContain('Compare changes');
    expect(result).toContain('PR #123');
    expect(result).toMatchSnapshot();
  });

  it('uses full custom renderer', async () => {
    const options = getOptions();
    options.changelogOptions.renderPackageChangelog = async renderInfo =>
      `## ${renderInfo.newVersionChangelog.version}\n\nno notes for you`;

    const result = await renderChangelog(options);
    expect(result).toContain('# Change Log - foo'); // still includes header
    expect(result).toContain(markerComment); // still includes marker comment
    expect(result).toContain('no notes for you'); // uses custom version body
    expect(result).toContain('content here'); // includes previous content
    expect(result).toMatchSnapshot();
  });
});
