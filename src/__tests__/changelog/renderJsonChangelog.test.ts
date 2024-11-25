import { describe, expect, it } from '@jest/globals';
import type { ChangelogJson, PackageChangelog } from '../../types/ChangeLog';
import { renderJsonChangelog } from '../../changelog/renderJsonChangelog';

describe('renderJsonChangelog', () => {
  /** Get a changelog for the current version foo v1.2.3 */
  function getChangelog(): PackageChangelog {
    return {
      date: new Date('Thu Aug 22 2019 14:20:40 GMT-0700 (Pacific Daylight Time)'),
      name: 'foo',
      tag: 'foo_v1.2.3',
      version: '1.2.3',
      comments: {
        minor: [
          { comment: 'Awesome change', author: 'user1@example.com', commit: 'sha1', package: 'foo' },
          { comment: 'Boring change', author: 'user2@example.com', commit: 'sha2', package: 'foo' },
        ],
        patch: [
          { comment: 'Fix', author: 'user1@example.com', commit: 'sha3', package: 'foo' },
          { comment: 'stuff', author: 'user2@example.com', commit: 'sha4', package: 'foo' },
        ],
      },
    };
  }

  /** Get a CHANGELOG.json for previous versions of foo */
  function getPreviousChangelog(versions: string[]): ChangelogJson {
    return {
      name: 'foo',
      entries: versions.map(version => ({
        date: 'Thu, 21 Aug 2019 20:20:40 GMT',
        version,
        tag: 'foo_v' + version,
        comments: {
          patch: [{ comment: 'Fix', author: 'user1@example.com', commit: 'sha3', package: 'foo' }],
        },
      })),
    };
  }

  it('renders if no previous changelog', () => {
    const changelog = getChangelog();
    const { name, ...rest } = changelog;

    const finalChangeLog = renderJsonChangelog({ changelog, previousChangelog: undefined, maxVersions: undefined });
    expect(finalChangeLog).toEqual({
      name,
      entries: [
        {
          ...rest,
          date: 'Thu, 22 Aug 2019 21:20:40 GMT',
        },
      ],
    });
  });

  it('preserves previous entries', () => {
    const changelog = getChangelog();
    const previousChangelog = getPreviousChangelog(['1.2.2']);

    const finalChangeLog = renderJsonChangelog({ changelog, previousChangelog, maxVersions: undefined });
    expect(finalChangeLog).toEqual({
      name: 'foo',
      entries: [expect.objectContaining({ version: '1.2.3' }), expect.objectContaining({ version: '1.2.2' })],
    });
  });

  it('trims previous entries over maxVersions', () => {
    const changelog = getChangelog();
    const previousChangelog = getPreviousChangelog(['1.2.2', '1.2.1', '1.2.0', '1.1.0']);

    const finalChangeLog = renderJsonChangelog({ changelog, previousChangelog, maxVersions: 3 });
    expect(finalChangeLog).toEqual({
      name: 'foo',
      entries: [
        expect.objectContaining({ version: '1.2.3' }),
        expect.objectContaining({ version: '1.2.2' }),
        expect.objectContaining({ version: '1.2.1' }),
      ],
    });
  });
});
