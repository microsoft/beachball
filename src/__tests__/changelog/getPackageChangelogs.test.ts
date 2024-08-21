import { describe, expect, it, jest } from '@jest/globals';
import { getPackageChangelogs } from '../../changelog/getPackageChangelogs';
import { BumpInfo } from '../../types/BumpInfo';
import { ChangeFileInfo, ChangeSet } from '../../types/ChangeInfo';
import { PackageInfos } from '../../types/PackageInfo';
import { makePackageInfos } from '../../__fixtures__/packageInfos';

// Mock the methods used from workspace-tools so we don't access the filesystem
jest.mock('workspace-tools', () => ({
  findProjectRoot: () => '.',
  getFileAddedHash: () => 'deadbeef',
}));

function makeChangeInfo(pkg: string, overrides?: Partial<ChangeFileInfo>): ChangeSet[number] {
  return {
    changeFile: `${pkg}.json`,
    change: {
      comment: `comment for ${pkg}`,
      dependentChangeType: 'patch',
      email: 'something@something.com',
      packageName: pkg,
      type: 'patch',
      ...overrides,
    },
  };
}

describe('getPackageChangelogs', () => {
  it('generates correct changelog entries for a single package', () => {
    const changeFileChangeInfos: ChangeSet = [
      makeChangeInfo('foo'),
      makeChangeInfo('foo', { type: 'minor', comment: 'other comment' }),
    ];
    const packageInfos = makePackageInfos({ foo: { version: '1.0.0' } });

    const changelogs = getPackageChangelogs({
      changeFileChangeInfos,
      calculatedChangeTypes: { foo: 'patch' },
      packageInfos,
      cwd: '.',
    });

    expect(changelogs.foo).toEqual({
      comments: {
        minor: [{ author: 'something@something.com', comment: 'other comment', commit: 'deadbeef', package: 'foo' }],
        patch: [{ author: 'something@something.com', comment: 'comment for foo', commit: 'deadbeef', package: 'foo' }],
      },
      date: expect.any(Date),
      name: 'foo',
      tag: 'foo_v1.0.0',
      version: '1.0.0',
    });
    expect(changelogs.foo.comments.patch).toHaveLength(1);
  });

  it('generates correct changelog entries for multiple packages', () => {
    const changeFileChangeInfos: ChangeSet = [makeChangeInfo('foo'), makeChangeInfo('bar')];
    const packageInfos = makePackageInfos({
      foo: { version: '1.0.0' },
      bar: { version: '2.0.0' },
    });

    const changelogs = getPackageChangelogs({
      changeFileChangeInfos,
      calculatedChangeTypes: { foo: 'patch', bar: 'patch' },
      packageInfos,
      cwd: '.',
    });

    expect(changelogs.foo).toEqual({
      comments: {
        patch: [{ author: 'something@something.com', comment: 'comment for foo', commit: 'deadbeef', package: 'foo' }],
      },
      date: expect.any(Date),
      name: 'foo',
      tag: 'foo_v1.0.0',
      version: '1.0.0',
    });
    expect(changelogs.bar).toEqual({
      comments: {
        patch: [{ author: 'something@something.com', comment: 'comment for bar', commit: 'deadbeef', package: 'bar' }],
      },
      date: expect.any(Date),
      name: 'bar',
      tag: 'bar_v2.0.0',
      version: '2.0.0',
    });
  });

  it('preserves custom properties from change files', () => {
    const changeFileChangeInfos: ChangeSet = [makeChangeInfo('foo', { extra: 'prop' })];
    const packageInfos: PackageInfos = makePackageInfos({ foo: { version: '1.0.0' } });

    const changelogs = getPackageChangelogs({
      changeFileChangeInfos,
      calculatedChangeTypes: { foo: 'patch' },
      packageInfos,
      cwd: '.',
    });

    expect(changelogs.foo.comments.patch![0]).toMatchObject({ extra: 'prop' });
  });

  it('records dependent bumps', () => {
    const changeFileChangeInfos: ChangeSet = [makeChangeInfo('foo')];

    const dependentChangedBy: BumpInfo['dependentChangedBy'] = {
      bar: new Set(['foo']),
    };

    const packageInfos = makePackageInfos({
      foo: { version: '1.0.0' },
      bar: { version: '2.0.0', dependencies: { foo: '^1.0.0' } },
    });

    const changelogs = getPackageChangelogs({
      changeFileChangeInfos,
      calculatedChangeTypes: { foo: 'patch', bar: 'patch' },
      dependentChangedBy,
      packageInfos,
      cwd: '.',
    });

    expect(Object.keys(changelogs.foo.comments.patch!)).toHaveLength(1);
    expect(changelogs.bar).toEqual({
      comments: {
        patch: [
          {
            author: 'beachball',
            package: 'bar',
            comment: 'Bump foo to v1.0.0',
            // IMPORTANT: this should not record an actual commit hash, because it will be incorrect
            commit: 'not available',
          },
        ],
      },
      date: expect.any(Date),
      name: 'bar',
      tag: 'bar_v2.0.0',
      version: '2.0.0',
    });
    expect(Object.keys(changelogs.bar.comments.patch!)).toHaveLength(1);
  });

  it('records multiple comment entries when a package has a change file AND was part of a dependent bump', () => {
    const changeFileChangeInfos: ChangeSet = [makeChangeInfo('foo'), makeChangeInfo('bar')];

    const dependentChangedBy: BumpInfo['dependentChangedBy'] = {
      bar: new Set(['foo']),
    };

    const packageInfos = makePackageInfos({
      foo: { version: '1.0.0' },
      bar: { version: '2.0.0', dependencies: { foo: '^1.0.0' } },
    });

    const changelogs = getPackageChangelogs({
      changeFileChangeInfos,
      calculatedChangeTypes: { foo: 'patch', bar: 'patch' },
      dependentChangedBy,
      packageInfos,
      cwd: '.',
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
    const changeFileChangeInfos: ChangeSet = [makeChangeInfo('bar')];

    const dependentChangedBy: BumpInfo['dependentChangedBy'] = {
      'private-pkg': new Set(['bar']),
    };

    const packageInfos = makePackageInfos({
      'private-pkg': {
        version: '1.0.0',
        private: true,
        dependencies: { bar: '^1.0.0' },
      },
      bar: { version: '1.0.0' },
    });

    const changelogs = getPackageChangelogs({
      changeFileChangeInfos,
      calculatedChangeTypes: { bar: 'patch', 'private-pkg': 'patch' },
      dependentChangedBy,
      packageInfos,
      cwd: '.',
    });

    expect(changelogs.bar).toBeTruthy();
    expect(changelogs['private-pkg']).toBeUndefined();
  });
});
