import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { getPackageChangelogs } from '../../changelog/getPackageChangelogs';
import type { ChangeFileInfo, ChangeSet } from '../../types/ChangeInfo';
import { makePackageInfos, type PartialPackageInfos } from '../../__fixtures__/packageInfos';
import { getFileAddedHash } from 'workspace-tools';

type PartialBumpInfo = Parameters<typeof getPackageChangelogs>[0];

const commit = 'deadbeef';
const author = 'something@something.com';

// Mock the methods used from workspace-tools so we don't access the filesystem
jest.mock('workspace-tools', () => ({
  findProjectRoot: () => '.',
  getFileAddedHash: jest.fn(() => commit),
}));

describe('getPackageChangelogs', () => {
  // eslint-disable-next-line etc/no-deprecated
  const getFileAddedHashMock = getFileAddedHash as jest.MockedFunction<typeof getFileAddedHash>;

  /**
   * Call `getPackageChangelogs` with filled in params. Defaults:
   * - package version `1.0.0`
   * - `author` and `commit` constants
   * - `changeType: 'patch'`
   */
  function getPackageChangelogsWrapper(
    bumpInfo: Pick<PartialBumpInfo, 'calculatedChangeTypes' | 'dependentChangedBy'> & {
      packageInfos: PartialPackageInfos;
      /** Changed package names or change file info (must include `packageName`) */
      changes: (string | Partial<ChangeFileInfo>)[];
    },
    options?: Partial<Parameters<typeof getPackageChangelogs>[1]>
  ) {
    return getPackageChangelogs(
      {
        packageInfos: makePackageInfos(bumpInfo.packageInfos),
        calculatedChangeTypes: bumpInfo.calculatedChangeTypes,
        dependentChangedBy: bumpInfo.dependentChangedBy,
        changeFileChangeInfos: bumpInfo.changes.map((change): ChangeSet[number] => {
          const pkg = typeof change === 'string' ? change : change.packageName!;
          return {
            changeFile: `${pkg}.json`,
            change: {
              comment: `comment for ${pkg}`,
              dependentChangeType: 'patch',
              email: author,
              packageName: pkg,
              type: 'patch',
              ...(typeof change === 'string' ? {} : change),
            },
          };
        }),
      },
      { path: '.', changeDir: 'change', ...options }
    );
  }

  afterEach(() => {
    getFileAddedHashMock.mockClear();
  });

  it('generates correct changelog entries for a single package', () => {
    const changelogs = getPackageChangelogsWrapper({
      packageInfos: { foo: { version: '1.0.0' } },
      calculatedChangeTypes: { foo: 'patch' },
      changes: ['foo', { packageName: 'foo', type: 'minor', comment: 'other comment' }],
    });

    expect(changelogs.foo).toEqual({
      comments: {
        minor: [{ author, comment: 'other comment', commit, package: 'foo' }],
        patch: [{ author, comment: 'comment for foo', commit, package: 'foo' }],
      },
      date: expect.any(Date),
      name: 'foo',
      tag: 'foo_v1.0.0',
      version: '1.0.0',
    });

    // the fake change files use the same default filename
    expect(getFileAddedHashMock).toHaveBeenCalledTimes(1);
  });

  it('generates correct changelog entries for multiple packages', () => {
    const changelogs = getPackageChangelogsWrapper({
      packageInfos: {
        foo: { version: '1.0.0' },
        bar: { version: '2.0.0' },
      },
      calculatedChangeTypes: { foo: 'patch', bar: 'patch' },
      changes: ['foo', 'bar'],
    });

    expect(changelogs.foo).toEqual({
      comments: {
        patch: [{ author, comment: 'comment for foo', commit, package: 'foo' }],
      },
      date: expect.any(Date),
      name: 'foo',
      tag: 'foo_v1.0.0',
      version: '1.0.0',
    });
    expect(changelogs.bar).toEqual({
      comments: {
        patch: [{ author, comment: 'comment for bar', commit, package: 'bar' }],
      },
      date: expect.any(Date),
      name: 'bar',
      tag: 'bar_v2.0.0',
      version: '2.0.0',
    });

    expect(getFileAddedHashMock).toHaveBeenCalledTimes(2);
  });

  it('preserves custom properties from change files', () => {
    const changelogs = getPackageChangelogsWrapper({
      packageInfos: { foo: { version: '1.0.0' } },
      calculatedChangeTypes: { foo: 'patch' },
      changes: [{ packageName: 'foo', extra: 'prop' }],
    });
    expect(changelogs.foo.comments.patch![0]).toMatchObject({ extra: 'prop' });
  });

  it('records dependent bumps', () => {
    const changelogs = getPackageChangelogsWrapper({
      packageInfos: {
        foo: { version: '1.0.0' },
        bar: { version: '2.0.0', dependencies: { foo: '^1.0.0' } },
      },
      calculatedChangeTypes: { foo: 'patch', bar: 'patch' },
      changes: ['foo'],
      dependentChangedBy: { bar: new Set(['foo']) },
    });

    expect(Object.keys(changelogs.foo.comments.patch!)).toHaveLength(1);
    expect(changelogs.bar).toEqual({
      comments: {
        patch: [
          // IMPORTANT: this should not record an actual commit hash, because it will be incorrect
          { author: 'beachball', package: 'bar', comment: 'Bump foo to v1.0.0', commit: 'not available' },
        ],
      },
      date: expect.any(Date),
      name: 'bar',
      tag: 'bar_v2.0.0',
      version: '2.0.0',
    });
    expect(getFileAddedHashMock).toHaveBeenCalledTimes(1);
  });

  it('records multiple comment entries when a package has a change file AND was part of a dependent bump', () => {
    const changelogs = getPackageChangelogsWrapper({
      packageInfos: {
        foo: { version: '1.0.0' },
        bar: { version: '2.0.0', dependencies: { foo: '^1.0.0' } },
      },
      calculatedChangeTypes: { foo: 'patch', bar: 'patch' },
      changes: ['foo', 'bar'],
      dependentChangedBy: { bar: new Set(['foo']) },
    });

    expect(changelogs.bar.comments).toEqual({
      patch: [
        expect.objectContaining({ comment: 'comment for bar' }),
        expect.objectContaining({ comment: 'Bump foo to v1.0.0' }),
      ],
    });
    expect(changelogs.foo.comments).toEqual({
      patch: [expect.objectContaining({ comment: 'comment for foo' })],
    });
  });

  it('does not generate changelogs for dependent bumps of private packages', () => {
    const changelogs = getPackageChangelogsWrapper({
      packageInfos: {
        'private-pkg': { private: true, dependencies: { bar: '^1.0.0' } },
        bar: {},
      },
      calculatedChangeTypes: { bar: 'patch', 'private-pkg': 'patch' },
      changes: ['bar'],
      dependentChangedBy: { 'private-pkg': new Set(['bar']) },
    });

    expect(changelogs.bar).toBeTruthy();
    expect(changelogs['private-pkg']).toBeUndefined();
  });

  it('omits commit hashes if requested', () => {
    const changelogs = getPackageChangelogsWrapper(
      {
        packageInfos: { foo: { version: '1.0.0' } },
        calculatedChangeTypes: { foo: 'patch' },
        changes: ['foo'],
      },
      { changelog: { includeCommitHashes: false } }
    );

    expect(changelogs.foo.comments.patch).toHaveLength(1);
    expect(changelogs.foo.comments.patch![0].commit).toBeUndefined();
    expect(getFileAddedHashMock).not.toHaveBeenCalled();
  });

  it('ignores dependent bumps for packages with no calculatedChangeType', () => {
    // This happens when bumpDeps is false or the dependent is out of scope
    // (Related issue for why the package ends up in dependentChangedBy at all: https://github.com/microsoft/beachball/issues/1123
    // and this test could potentially be removed once the issue is fixed)
    const changelogs = getPackageChangelogsWrapper({
      packageInfos: {
        foo: { version: '1.0.0' },
        bar: { version: '2.0.0', dependencies: { foo: '^1.0.0' } },
      },
      calculatedChangeTypes: { foo: 'patch' },
      changes: ['foo'],
      dependentChangedBy: { bar: new Set(['foo']) },
    });

    expect(changelogs.foo).toBeDefined();
    expect(changelogs.bar).toBeUndefined();
  });
});
