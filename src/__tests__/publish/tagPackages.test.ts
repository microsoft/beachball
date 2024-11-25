import { describe, expect, it, jest, beforeEach, afterAll } from '@jest/globals';
import { gitFailFast } from 'workspace-tools';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { tagPackages } from '../../publish/tagPackages';
import { generateTag } from '../../git/generateTag';
import { makePackageInfos } from '../../__fixtures__/packageInfos';

jest.mock('workspace-tools', () => ({
  gitFailFast: jest.fn(),
}));

const createTagParameters = (tag: string, cwd: string) => {
  return [['tag', '-a', '-f', tag, '-m', tag], { cwd }];
};

type TagBumpInfo = Parameters<typeof tagPackages>[0];

/** foo and bar disable gitTags */
const noTagBumpInfo: TagBumpInfo = {
  calculatedChangeTypes: {
    foo: 'minor',
    bar: 'major',
  },
  packageInfos: makePackageInfos({
    foo: {
      version: '1.0.0',
      combinedOptions: { gitTags: false },
    },
    bar: {
      version: '1.0.1',
      combinedOptions: { gitTags: false },
    },
  }),
  modifiedPackages: new Set(['foo', 'bar']),
  newPackages: [],
};

/** foo enables gitTags, bar disables it */
const oneTagBumpInfo: TagBumpInfo = {
  ...noTagBumpInfo,
  packageInfos: makePackageInfos({
    foo: {
      version: '1.0.0',
      combinedOptions: { gitTags: true },
    },
    bar: {
      version: '1.0.1',
      combinedOptions: { gitTags: false },
    },
  }),
};

const emptyBumpInfo: TagBumpInfo = {
  calculatedChangeTypes: {},
  packageInfos: {},
  modifiedPackages: new Set(),
  newPackages: [],
};

describe('tagPackages', () => {
  initMockLogs();

  beforeEach(() => {
    (gitFailFast as jest.Mock).mockReset();
  });

  afterAll(() => {
    jest.restoreAllMocks();
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
    expect(gitFailFast).toHaveBeenCalledWith(...createTagParameters(newFooTag, ''));
  });

  it('creates package tag for new packages with gitTags=true', () => {
    tagPackages(
      { ...oneTagBumpInfo, newPackages: ['foo'], modifiedPackages: new Set() },
      { path: '', gitTags: false, tag: '' }
    );
    expect(gitFailFast).toHaveBeenCalledTimes(1);

    // verify git is being called to create new auto tag for foo
    const newFooTag = generateTag('foo', oneTagBumpInfo.packageInfos['foo'].version);
    expect(gitFailFast).toHaveBeenCalledWith(...createTagParameters(newFooTag, ''));
  });

  it('does not create package tag for packages with changeType none', () => {
    tagPackages({ ...oneTagBumpInfo, calculatedChangeTypes: { foo: 'none' } }, { path: '', gitTags: false, tag: '' });
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
    expect(gitFailFast).toHaveBeenCalledWith(...createTagParameters('abc', ''));
  });
});
