import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { gitFailFast as _gitFailFast } from 'workspace-tools';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { tagPackages } from '../../publish/tagPackages';
import { generateTag } from '../../git/generateTag';
import { makePackageInfos } from '../../__fixtures__/packageInfos';

jest.mock('workspace-tools', () => ({
  gitFailFast: jest.fn(),
}));
const gitFailFast = _gitFailFast as jest.MockedFunction<typeof _gitFailFast>;

const createTagParameters = (tag: string) => {
  return [['tag', '-a', '-f', tag, '-m', tag], { cwd: '' }];
};

type TagBumpInfo = Parameters<typeof tagPackages>[0];

/** repo options disable gitTags */
const noTagBumpInfo: TagBumpInfo = {
  calculatedChangeTypes: {
    foo: 'minor',
    bar: 'major',
  },
  packageInfos: makePackageInfos(
    {
      foo: { version: '1.0.0' },
      bar: { version: '1.0.1' },
    },
    { gitTags: false }
  ),
  modifiedPackages: new Set(['foo', 'bar']),
  scopedPackages: new Set(['foo', 'bar']),
  newPackages: [],
};

/** foo enables gitTags, bar disables it, repo disables it */
const oneTagBumpInfo: TagBumpInfo = {
  ...noTagBumpInfo,
  packageInfos: makePackageInfos({
    foo: {
      version: '1.0.0',
      beachball: { gitTags: true },
    },
    bar: {
      version: '1.0.1',
      beachball: { gitTags: false },
    },
  }),
};

const emptyBumpInfo: TagBumpInfo = {
  calculatedChangeTypes: {},
  packageInfos: {},
  modifiedPackages: new Set(),
  newPackages: [],
  scopedPackages: new Set(),
};

describe('tagPackages', () => {
  initMockLogs();

  beforeEach(() => {
    gitFailFast.mockReset();
  });

  it('does not create package tag for packages with gitTags=false', () => {
    // Also verifies that if `gitTags` is false overall, it doesn't create a git tag for the dist tag (`tag`)
    tagPackages(noTagBumpInfo, { path: '', gitTags: false, tag: '' });
    expect(gitFailFast).not.toHaveBeenCalled();
  });

  it('creates package tag for packages with gitTags=true', () => {
    tagPackages(oneTagBumpInfo, { path: '', gitTags: false, tag: '' });
    expect(gitFailFast).toHaveBeenCalledTimes(1);

    // verify git is being called to create new auto tag for foo and bar
    const newFooTag = generateTag('foo', oneTagBumpInfo.packageInfos['foo'].version);
    expect(gitFailFast).toHaveBeenCalledWith(...createTagParameters(newFooTag));
  });

  it('creates package tag for new packages with gitTags=true', () => {
    tagPackages(
      { ...oneTagBumpInfo, newPackages: ['foo'], modifiedPackages: new Set() },
      { path: '', gitTags: false, tag: '' }
    );
    expect(gitFailFast).toHaveBeenCalledTimes(1);

    // verify git is being called to create new auto tag for foo
    const newFooTag = generateTag('foo', oneTagBumpInfo.packageInfos['foo'].version);
    expect(gitFailFast).toHaveBeenCalledWith(...createTagParameters(newFooTag));
  });

  it('tags multiple packages with gitTags=true', () => {
    const modifiedPackages = new Set(['foo', 'bar']);
    tagPackages(
      { ...oneTagBumpInfo, modifiedPackages, packageInfos: makePackageInfos({ foo: {}, bar: {} }) },
      { path: '', gitTags: true, tag: 'beta' }
    );
    expect(gitFailFast).toHaveBeenCalledTimes(3);

    // verify git is being called to create new auto tags for foo and bar,
    // and an overall tag since it's not "latest"
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
    expect(gitFailFast).toBeCalledTimes(1);
    expect(gitFailFast).toHaveBeenCalledWith(...createTagParameters('abc'));
  });
});
