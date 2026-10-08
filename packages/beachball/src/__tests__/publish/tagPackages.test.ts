import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { initMockLogs } from '@microsoft/beachball-test-utilities';
import { gitFailFast as _gitFailFast } from 'workspace-tools';
import { tagPackages } from '../../publish/tagPackages';
import type { BumpInfo } from '../../types/BumpInfo';

jest.mock('workspace-tools', () => ({
  gitFailFast: jest.fn(),
}));
const gitFailFast = _gitFailFast as jest.MockedFunction<typeof _gitFailFast>;

const createTagParameters = (tag: string) => {
  return [['tag', '-a', '-f', tag, '-m', tag], { cwd: '' }] as [string[], { cwd: string }];
};

describe('tagPackages', () => {
  initMockLogs();

  beforeEach(() => {
    gitFailFast.mockReset();
  });

  it('does nothing when packageTags is empty', () => {
    tagPackages({}, { path: '' });
    expect(gitFailFast).not.toHaveBeenCalled();
  });

  it('skips packages whose tag entry is undefined', () => {
    const packageTags: BumpInfo['packageTags'] = { foo: undefined, bar: undefined };
    tagPackages(packageTags, { path: '' });
    expect(gitFailFast).not.toHaveBeenCalled();
  });

  it('creates a single tag for each package with one tag entry', () => {
    const packageTags: BumpInfo['packageTags'] = {
      foo: [{ tag: 'foo_v1.0.0' }],
      bar: [{ tag: 'bar_v2.0.0' }],
    };
    tagPackages(packageTags, { path: '' });

    const gitCalls = gitFailFast.mock.calls.map(([args]) => args.join(' '));
    expect(gitCalls).toEqual(['tag -a -f foo_v1.0.0 -m foo_v1.0.0', 'tag -a -f bar_v2.0.0 -m bar_v2.0.0']);
  });

  it('creates all tags when a package has multiple tag entries', () => {
    const packageTags: BumpInfo['packageTags'] = {
      foo: [
        { tag: 'tag-a', isCustom: true },
        { tag: 'tag-b', isCustom: true },
      ],
    };
    tagPackages(packageTags, { path: '' });

    expect(gitFailFast).toHaveBeenCalledTimes(2);
    expect(gitFailFast).toHaveBeenCalledWith(...createTagParameters('tag-a'));
    expect(gitFailFast).toHaveBeenCalledWith(...createTagParameters('tag-b'));
  });

  it('dedupes tags across packages', () => {
    const packageTags: BumpInfo['packageTags'] = {
      foo: [{ tag: 'foo_v1.0.0' }, { tag: 'shared-tag', isCustom: true }],
      bar: [
        { tag: 'shared-tag', isCustom: true },
        { tag: 'foo_v1.0.0', isCustom: true },
      ],
    };
    tagPackages(packageTags, { path: '' });

    expect(gitFailFast).toHaveBeenCalledTimes(2);
    const gitCalls = gitFailFast.mock.calls.map(([args]) => args.join(' '));
    expect(gitCalls).toEqual(['tag -a -f foo_v1.0.0 -m foo_v1.0.0', 'tag -a -f shared-tag -m shared-tag']);
  });
});
