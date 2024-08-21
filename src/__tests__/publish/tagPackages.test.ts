import { describe, expect, it, jest, beforeEach, afterAll } from '@jest/globals';
import type { Mock } from 'jest-mock';
import { gitFailFast } from 'workspace-tools';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { tagPackages } from '../../publish/tagPackages';
import { generateTag } from '../../git/generateTag';
import { BumpInfo } from '../../types/BumpInfo';
import { makePackageInfos } from '../../__fixtures__/packageInfos';

jest.mock('workspace-tools', () => ({
  gitFailFast: jest.fn(),
}));

const createTagParameters = (tag: string, cwd: string) => {
  return [['tag', '-a', '-f', tag, '-m', tag], { cwd }];
};

const noTagBumpInfo: Partial<BumpInfo> = {
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
  newPackages: new Set(),
};

const oneTagBumpInfo: Partial<BumpInfo> = {
  calculatedChangeTypes: {
    foo: 'minor',
    bar: 'major',
  },
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
  modifiedPackages: new Set(['foo', 'bar']),
  newPackages: new Set(),
};

const emptyBumpInfo: Partial<BumpInfo> = {
  calculatedChangeTypes: {},
  packageInfos: {},
  modifiedPackages: new Set(),
  newPackages: new Set(),
};

describe('tagPackages', () => {
  initMockLogs();

  beforeEach(() => {
    (gitFailFast as Mock).mockReset();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('does not create tag for packages with gitTags=false', () => {
    // Also verifies that if `gitTags` is false overall, it doesn't create a git tag for the dist tag (`tag`)
    tagPackages(noTagBumpInfo as BumpInfo, { path: '', gitTags: false, tag: '' });
    expect(gitFailFast).not.toHaveBeenCalled();
  });

  it('creates tag for packages with gitTags=true', () => {
    tagPackages(oneTagBumpInfo as BumpInfo, { path: '', gitTags: false, tag: '' });
    expect(gitFailFast).toHaveBeenCalledTimes(1);

    // verify git is being called to create new auto tag for foo and bar
    const newFooTag = generateTag('foo', oneTagBumpInfo.packageInfos!['foo'].version);
    expect(gitFailFast).toHaveBeenCalledWith(...createTagParameters(newFooTag, ''));
  });

  it('does not create git tag for empty dist tag', () => {
    tagPackages(emptyBumpInfo as BumpInfo, { path: '', gitTags: true, tag: '' });
    expect(gitFailFast).not.toHaveBeenCalled();
  });

  it('does not create git tag for "latest" dist tag', () => {
    tagPackages(emptyBumpInfo as BumpInfo, { path: '', gitTags: true, tag: 'latest' });
    expect(gitFailFast).not.toHaveBeenCalled();
  });

  it('creates git tag for non-"latest" dist tag', () => {
    tagPackages(emptyBumpInfo as BumpInfo, { path: '', gitTags: true, tag: 'abc' });
    expect(gitFailFast).toBeCalledTimes(1);
    expect(gitFailFast).toHaveBeenCalledWith(...createTagParameters('abc', ''));
  });
});
