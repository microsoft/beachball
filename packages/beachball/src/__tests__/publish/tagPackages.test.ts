import { tagPackages } from '../../publish/tagPackages';
import { generateTag } from '../../tag';
import { BumpInfo } from '../../types/BumpInfo';
import { gitFailFast } from '../../git';

jest.mock('../../git', () => ({
  gitFailFast: jest.fn(),
}));

const createTagParameters = (tag: string, cwd: string) => {
  return [['tag', '-a', '-f', tag, '-m', tag], { cwd }];
};

const bumpInfo = ({
  packageChangeTypes: {
    foo: 'minor',
    bar: 'major',
  },
  packageInfos: {
    foo: {
      name: 'foo',
      version: '1.0.0',
    },
    bar: {
      name: 'bar',
      version: '1.0.1',
    },
  },
  modifiedPackages: new Set(['foo', 'bar']),
  newPackages: new Set(),
} as unknown) as BumpInfo;

describe('tagPackages', () => {
  beforeEach(() => {
    (gitFailFast as jest.Mock).mockReset();
  });

  it('createTag is not called when gitTags is false', () => {
    tagPackages(bumpInfo, /* gitTag */ false, /* tag */ 'abc', /* cwd*/ '');
    expect(gitFailFast).not.toBeCalled();

    tagPackages(bumpInfo, /* gitTag */ false, /* tag */ 'latest', /* cwd*/ '');
    expect(gitFailFast).not.toBeCalled();
  });

  it('createTag is called when gitTags is true', () => {
    tagPackages(bumpInfo, /* gitTags */ true, /* tag */ '', /* cwd*/ '');
    // verify git is being called to create new auto tag for foo and bar
    const newFooTag = generateTag('foo', bumpInfo.packageInfos['foo'].version);
    const newBarTag = generateTag('bar', bumpInfo.packageInfos['bar'].version);
    expect(gitFailFast).toBeCalledTimes(2);
    expect(gitFailFast).toHaveBeenNthCalledWith(1, ...createTagParameters(newFooTag, ''));
    expect(gitFailFast).toHaveBeenNthCalledWith(2, ...createTagParameters(newBarTag, ''));
  });

  it('createTag is called when gitTags is true and a tag is passed', () => {
    tagPackages(bumpInfo, /* gitTags */ true, /* tag */ 'abc', /* cwd*/ '');
    // verify git is being called to create new auto tag for foo and bar
    const newFooTag = generateTag('foo', bumpInfo.packageInfos['foo'].version);
    const newBarTag = generateTag('bar', bumpInfo.packageInfos['bar'].version);
    expect(gitFailFast).toBeCalledTimes(3);
    expect(gitFailFast).toHaveBeenNthCalledWith(1, ...createTagParameters(newFooTag, ''));
    expect(gitFailFast).toHaveBeenNthCalledWith(2, ...createTagParameters(newBarTag, ''));
    expect(gitFailFast).toHaveBeenNthCalledWith(3, ...createTagParameters('abc', ''));
  });
});
