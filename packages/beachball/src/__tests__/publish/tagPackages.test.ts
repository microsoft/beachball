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
  it('auto tag enabled', () => {
    tagPackages(bumpInfo, /* autotag */ true, /* tag */ '', /* cwd*/ '');
    // verify git is being called to create new auto tag for foo and bar
    const newFooTag = generateTag('foo', bumpInfo.packageInfos['foo'].version);
    const newBarTag = generateTag('bar', bumpInfo.packageInfos['bar'].version);
    expect(gitFailFast).toBeCalledTimes(2);
    expect(gitFailFast).toHaveBeenNthCalledWith(1, ...createTagParameters(newFooTag, ''));
    expect(gitFailFast).toHaveBeenNthCalledWith(2, ...createTagParameters(newBarTag, ''));
  });

  it('tag is passed', () => {
    tagPackages(bumpInfo, /* autotag */ false, /* tag */ 'abc', /* cwd*/ 'cwd');
    expect(gitFailFast).toBeCalledWith(...createTagParameters('abc', 'cwd'));
  });

  it('autotag and tag are disabled', () => {
    tagPackages(bumpInfo, /* autotag */ false, /* tag */ '', /* cwd*/ '');
    // verify git is not being called to create a new auto tag (foo_v1.0.0) as auto tag is disabled
    expect(gitFailFast).not.toBeCalled();
  });

  it('createTag is not called when latest is passed as a tag', () => {
    tagPackages(bumpInfo, /* autotag */ false, /* tag */ 'latest', /* cwd*/ '');
    expect(gitFailFast).not.toBeCalled();
  });
});
