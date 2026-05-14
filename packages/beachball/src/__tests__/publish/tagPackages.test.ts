import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { gitFailFast as _gitFailFast } from 'workspace-tools';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { tagPackages } from '../../publish/tagPackages';
import { makePackageInfos } from '../../__fixtures__/packageInfos';

jest.mock('workspace-tools', () => ({
  gitFailFast: jest.fn(),
}));
const gitFailFast = _gitFailFast as jest.MockedFunction<typeof _gitFailFast>;

const createTagParameters = (tag: string) => {
  return [['tag', '-a', '-f', tag, '-m', tag], { cwd: '' }] as [string[], { cwd: string }];
};

type TagBumpInfo = Parameters<typeof tagPackages>[0];

/** All packages have tags disabled (no entries in packageTags) */
const noTagBumpInfo: TagBumpInfo = {
  calculatedChangeTypes: {
    foo: 'minor',
    bar: 'major',
  },
  packageInfos: makePackageInfos({
    foo: { version: '1.0.0' },
    bar: { version: '1.0.1' },
  }),
  modifiedPackages: new Set(['foo', 'bar']),
  scopedPackages: new Set(['foo', 'bar']),
  packageTags: {},
};

/** Only foo has a tag */
const oneTagBumpInfo: TagBumpInfo = {
  ...noTagBumpInfo,
  packageTags: { foo: ['foo_v1.0.0'], bar: undefined },
};

const emptyBumpInfo: TagBumpInfo = {
  calculatedChangeTypes: {},
  packageInfos: {},
  modifiedPackages: new Set(),
  scopedPackages: new Set(),
  packageTags: {},
};

describe('tagPackages', () => {
  initMockLogs();

  beforeEach(() => {
    gitFailFast.mockReset();
  });

  it('does not create package tag for packages with no precomputed tag', () => {
    // Also verifies that if `gitTags` is false overall, it doesn't create a git tag for the dist tag (`tag`)
    tagPackages(noTagBumpInfo, { path: '', gitTags: false, tag: '' });
    expect(gitFailFast).not.toHaveBeenCalled();
  });

  it('creates package tag for packages with a precomputed tag', () => {
    tagPackages(oneTagBumpInfo, { path: '', gitTags: false, tag: '' });
    expect(gitFailFast).toHaveBeenCalledTimes(1);
    expect(gitFailFast).toHaveBeenCalledWith(...createTagParameters('foo_v1.0.0'));
  });

  it('tags multiple packages and the overall dist tag', () => {
    const modifiedPackages = new Set(['foo', 'bar']);
    tagPackages(
      {
        ...oneTagBumpInfo,
        modifiedPackages,
        packageInfos: makePackageInfos({ foo: {}, bar: {} }),
        packageTags: { foo: ['foo_v1.0.0'], bar: ['bar_v1.0.0'] },
      },
      { path: '', gitTags: true, tag: 'beta' }
    );
    expect(gitFailFast).toHaveBeenCalledTimes(3);

    const gitCalls = gitFailFast.mock.calls.map(([args]) => args.join(' '));
    expect(gitCalls).toEqual([
      'tag -a -f foo_v1.0.0 -m foo_v1.0.0',
      'tag -a -f bar_v1.0.0 -m bar_v1.0.0',
      'tag -a -f beta -m beta',
    ]);
  });

  it('does not create package tag for packages with changeType none', () => {
    tagPackages({ ...oneTagBumpInfo, calculatedChangeTypes: { foo: 'none' } }, { path: '', gitTags: false, tag: '' });
    expect(gitFailFast).not.toHaveBeenCalled();
  });

  it('does not create package tag for packages with no changeType', () => {
    tagPackages({ ...oneTagBumpInfo, calculatedChangeTypes: {} }, { path: '', gitTags: false, tag: '' });
    expect(gitFailFast).not.toHaveBeenCalled();
  });

  it('does not create package tag for out of scope package', () => {
    tagPackages({ ...oneTagBumpInfo, scopedPackages: new Set(['bar']) }, { path: '', gitTags: false, tag: '' });
    expect(gitFailFast).not.toHaveBeenCalled();
  });

  it('does not create overall git tag for empty dist tag', () => {
    tagPackages(emptyBumpInfo, { path: '', gitTags: true, tag: '' });
    expect(gitFailFast).not.toHaveBeenCalled();
  });

  it('does not create overall git tag for "latest" dist tag', () => {
    tagPackages(emptyBumpInfo, { path: '', gitTags: true, tag: 'latest' });
    expect(gitFailFast).not.toHaveBeenCalled();
  });

  it('creates overall git tag for non-"latest" dist tag', () => {
    tagPackages(emptyBumpInfo, { path: '', gitTags: true, tag: 'abc' });
    expect(gitFailFast).toHaveBeenCalledTimes(1);
    expect(gitFailFast).toHaveBeenCalledWith(...createTagParameters('abc'));
  });

  it('creates all tags when packageTags has multiple entries for a package', () => {
    const bumpInfo: TagBumpInfo = {
      calculatedChangeTypes: { foo: 'minor' },
      packageInfos: makePackageInfos({ foo: { version: '2.0.0' } }),
      modifiedPackages: new Set(['foo']),
      scopedPackages: new Set(['foo']),
      packageTags: { foo: ['tag-a', 'tag-b'] },
    };
    tagPackages(bumpInfo, { path: '', gitTags: true, tag: '' });
    expect(gitFailFast).toHaveBeenCalledTimes(2);
    expect(gitFailFast).toHaveBeenCalledWith(...createTagParameters('tag-a'));
    expect(gitFailFast).toHaveBeenCalledWith(...createTagParameters('tag-b'));
  });
});
