import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { gitFailFast as _gitFailFast } from 'workspace-tools';
import { initMockLogs } from '../../__fixtures__/mockLogs';
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
    tagPackages({}, { path: '', gitTags: false, tag: '' });
    expect(gitFailFast).not.toHaveBeenCalled();
  });

  it('skips packages whose tag entry is undefined', () => {
    const packageTags: BumpInfo['packageTags'] = { foo: undefined, bar: undefined };
    tagPackages(packageTags, { path: '', gitTags: true, tag: '' });
    expect(gitFailFast).not.toHaveBeenCalled();
  });

  it('creates a single tag for each package with one tag entry', () => {
    const packageTags: BumpInfo['packageTags'] = { foo: ['foo_v1.0.0'], bar: ['bar_v2.0.0'] };
    tagPackages(packageTags, { path: '', gitTags: true, tag: '' });

    const gitCalls = gitFailFast.mock.calls.map(([args]) => args.join(' '));
    expect(gitCalls).toEqual(['tag -a -f foo_v1.0.0 -m foo_v1.0.0', 'tag -a -f bar_v2.0.0 -m bar_v2.0.0']);
  });

  it('creates all tags when a package has multiple tag entries', () => {
    const packageTags: BumpInfo['packageTags'] = { foo: ['tag-a', 'tag-b'] };
    tagPackages(packageTags, { path: '', gitTags: true, tag: '' });

    expect(gitFailFast).toHaveBeenCalledTimes(2);
    expect(gitFailFast).toHaveBeenCalledWith(...createTagParameters('tag-a'));
    expect(gitFailFast).toHaveBeenCalledWith(...createTagParameters('tag-b'));
  });

  it('does not create overall git tag for empty dist tag', () => {
    tagPackages({}, { path: '', gitTags: true, tag: '' });
    expect(gitFailFast).not.toHaveBeenCalled();
  });

  it('does not create overall git tag for "latest" dist tag', () => {
    tagPackages({}, { path: '', gitTags: true, tag: 'latest' });
    expect(gitFailFast).not.toHaveBeenCalled();
  });

  it('does not create overall git tag when gitTags is false', () => {
    tagPackages({}, { path: '', gitTags: false, tag: 'beta' });
    expect(gitFailFast).not.toHaveBeenCalled();
  });

  it('creates overall git tag for non-"latest" dist tag when gitTags is true', () => {
    tagPackages({}, { path: '', gitTags: true, tag: 'abc' });
    expect(gitFailFast).toHaveBeenCalledTimes(1);
    expect(gitFailFast).toHaveBeenCalledWith(...createTagParameters('abc'));
  });

  it('creates both package tags and overall dist tag together', () => {
    const packageTags: BumpInfo['packageTags'] = { foo: ['foo_v1.0.0'], bar: ['bar_v1.0.0'] };
    tagPackages(packageTags, { path: '', gitTags: true, tag: 'beta' });

    const gitCalls = gitFailFast.mock.calls.map(([args]) => args.join(' '));
    expect(gitCalls).toEqual([
      'tag -a -f foo_v1.0.0 -m foo_v1.0.0',
      'tag -a -f bar_v1.0.0 -m bar_v1.0.0',
      'tag -a -f beta -m beta',
    ]);
  });
});
