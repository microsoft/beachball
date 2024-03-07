import { describe, expect, it, jest, beforeEach, afterAll } from '@jest/globals';
import type { Mock } from 'jest-mock';
import { gitFailFast } from 'workspace-tools';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { tagPackages } from '../../publish/tagPackages';
import { generateTag } from '../../git/generateTag';
import { BumpInfo } from '../../types/BumpInfo';
import { makePackageInfos } from '../../__fixtures__/packageInfos';
import { BeachballOptions } from '../../types/BeachballOptions';

jest.mock('workspace-tools', () => ({
  gitFailFast: jest.fn(),
}));

const createTagParameters = (tag: string, cwd: string) => {
  return [['tag', '-a', '-f', tag, '-m', tag], { cwd }];
};

const makeBumpInfo = (packageOptions: Record<'foo' | 'bar', Partial<BeachballOptions>>): BumpInfo => {
  const bumpInfo: Partial<BumpInfo> = {
    calculatedChangeTypes: {
      foo: 'minor',
      bar: 'major',
    },
    packageInfos: makePackageInfos({
      foo: {
        version: '1.0.0',
        combinedOptions: packageOptions.foo,
      },
      bar: {
        version: '1.0.1',
        combinedOptions: packageOptions.bar,
      },
    }),
    modifiedPackages: new Set(['foo', 'bar']),
    newPackages: new Set(),
  };
  return bumpInfo as BumpInfo;
};

const emptyBumpInfo: Partial<BumpInfo> = {
  calculatedChangeTypes: {},
  packageInfos: {},
  modifiedPackages: new Set(),
  newPackages: new Set(),
};

describe('tagPackages', () => {
  const logs = initMockLogs();

  beforeEach(() => {
    (gitFailFast as Mock).mockReset();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('does not create tag for packages with gitTags=false', () => {
    const bumpInfo = makeBumpInfo({ foo: { gitTags: false }, bar: { gitTags: false } });
    // Also verifies that if `gitTags` is false overall, it doesn't create a git tag for the dist tag (`tag`)
    tagPackages(bumpInfo, { path: '', gitTags: false, tag: '' });
    expect(gitFailFast).not.toHaveBeenCalled();
  });

  it('creates tag for packages with gitTags=true', () => {
    const bumpInfo = makeBumpInfo({ foo: { gitTags: true }, bar: { gitTags: false } });
    tagPackages(bumpInfo, { path: '', gitTags: false, tag: '' });
    expect(gitFailFast).toHaveBeenCalledTimes(1);

    // verify git is being called to create new auto tag for foo
    const newFooTag = generateTag('foo', bumpInfo.packageInfos!['foo'].version);
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

  it('does not create tags with dryRun=true', () => {
    // In dry run mode, it just logs the tags that would be created
    const bumpInfo = makeBumpInfo({ foo: { gitTags: true }, bar: { gitTags: true } });
    tagPackages(bumpInfo, { path: '', dryRun: true, gitTags: true, tag: 'foo' });
    expect(gitFailFast).not.toHaveBeenCalled();
    expect(logs.getMockLines('log').split('\n')).toEqual([
      'Would tag - foo@1.0.0',
      'Would tag - bar@1.0.1',
      'Would tag - foo',
    ]);
  });
});
