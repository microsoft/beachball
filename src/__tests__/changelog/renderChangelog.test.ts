import { describe, expect, it, jest } from '@jest/globals';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import {
  MarkdownChangelogRenderOptions,
  renderChangelog,
  markerComment,
  _trimPreviousLog,
  trimmedVersionsNote,
} from '../../changelog/renderChangelog';
import type { ChangelogEntry, PackageChangelog, ChangelogJson } from '../../types/ChangeLog';

/** Make a changelog string with a header and basic content for each version */
function changelogFromVersions(versions: string[]): string {
  // Having the change type h3 is important for testing trimming
  return versions.map(v => [`## ${v}`, '(date)', '### Patch changes', `- content of ${v}`].join('\n\n')).join('\n\n');
}

const previousHeader = `# Change Log - foo

<!-- This log was last generated on Wed, 21 Aug 2019 21:20:40 GMT and should not be manually modified. -->`;

const previousVersion = changelogFromVersions(['1.2.0']);

describe('renderChangelog', () => {
  initMockLogs();

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
      previousJson: {} as ChangelogJson,
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

  it('trims previous versions if over maxVersions', async () => {
    const options = getOptions();
    options.previousContent += '\n\n' + changelogFromVersions(['1.1.9', '1.1.8', '1.1.7']);
    options.changelogOptions.maxVersions = 3;

    const result = await renderChangelog(options);
    expect(result).toContain(trimmedVersionsNote);
    expect(result.trim().endsWith(trimmedVersionsNote)).toBe(true);
    expect(result).toContain(changelogFromVersions(['1.2.0']));
    expect(result).toContain(changelogFromVersions(['1.1.9']));
    expect(result).not.toContain('1.1.8');
    expect(result).not.toContain('1.1.7');
    // do a snapshot to make sure there's no funny formatting
    expect(result).toMatchSnapshot();
  });

  it('merges default and custom renderers', async () => {
    const options = getOptions();
    options.changelogOptions.customRenderers = {
      renderHeader: renderInfo => {
        return [
          `## ${renderInfo.newVersionChangelog.version}`,
          renderInfo.newVersionChangelog.date.toUTCString(),
          `[Compare changes](http://real-github-compare-link)`,
        ].join('\n');
      },
      renderEntry: entry => `- ${entry.comment} (${entry.author}, PR #123)`,
    };

    const result = await renderChangelog(options);
    expect(result).toContain('Compare changes');
    expect(result).toContain('PR #123');
    expect(result).toMatchSnapshot();
  });

  it('uses full custom renderer', async () => {
    const options = getOptions();
    options.changelogOptions.renderPackageChangelog = renderInfo =>
      `## ${renderInfo.newVersionChangelog.version}\n\nno notes for you`;

    const result = await renderChangelog(options);
    expect(result).toContain('# Change Log - foo'); // still includes header
    expect(result).toContain(markerComment); // still includes marker comment
    expect(result).toContain('no notes for you'); // uses custom version body
    expect(result).toContain(previousVersion); // includes previous content
    expect(result).toMatchSnapshot();
  });

  it('passes custom change file properties to renderers', async () => {
    const options = getOptions();
    options.newVersionChangelog.comments = {
      patch: [
        {
          comment: 'Awesome change',
          author: 'user1@example.com',
          commit: 'sha1',
          package: 'foo',
          extra: 'custom',
        },
      ],
    };
    options.changelogOptions.customRenderers = {
      renderEntry: jest.fn((entry: ChangelogEntry) => `- ${entry.comment} ${entry.extra})`),
    };
    options.changelogOptions.renderMainHeader = jest.fn(
      (packageChangelog: PackageChangelog) => `Custom main header ${packageChangelog.name}`
    );

    const result = await renderChangelog(options);
    expect(result).toContain('Awesome change custom');
    expect(result).toContain('Custom main header foo');
    expect(result).not.toContain('# Change Log -');
    expect(options.changelogOptions.customRenderers.renderEntry).toHaveBeenCalledWith(
      expect.objectContaining({ extra: 'custom' }),
      expect.anything()
    );
  });
});

describe('renderChangelog _trimPreviousLog', () => {
  it('returns log as-is if under max', () => {
    const previousLogEntries = changelogFromVersions(['1.2.2', '1.2.1']);
    const trimmed = _trimPreviousLog({
      packageChangelog: changelogFromVersions(['1.2.3']),
      previousLogEntries,
      maxVersions: 5,
    });
    expect(trimmed).toEqual(previousLogEntries);
  });

  it('returns log as-is if equal to max', () => {
    // 2 previous + current version = 3
    const previousLogEntries = changelogFromVersions(['1.2.2', '1.2.1']);
    const trimmed = _trimPreviousLog({
      packageChangelog: changelogFromVersions(['1.2.3']),
      previousLogEntries,
      maxVersions: 3,
    });
    expect(trimmed).toEqual(previousLogEntries);
  });

  it('trims versions if one over max', () => {
    // 3 previous + current version = 4
    const trimmed = _trimPreviousLog({
      packageChangelog: changelogFromVersions(['1.2.3']),
      previousLogEntries: changelogFromVersions(['1.2.2', '1.2.1', '1.2.0']),
      maxVersions: 3,
    });
    expect(trimmed).toEqual(changelogFromVersions(['1.2.2', '1.2.1']) + '\n\n' + trimmedVersionsNote);
  });

  it('trims versions if multiple over max', () => {
    const trimmed = _trimPreviousLog({
      packageChangelog: changelogFromVersions(['1.2.3']),
      previousLogEntries: changelogFromVersions(['1.2.2', '1.2.1', '1.2.0', '1.1.0']),
      maxVersions: 3,
    });
    expect(trimmed).toEqual(changelogFromVersions(['1.2.2', '1.2.1']) + '\n\n' + trimmedVersionsNote);
  });
});
