import { jest, describe, it, expect, beforeEach, beforeAll } from '@jest/globals';
import fs from 'fs';
import { getActionTags, getGitTag, postbumpHook } from './beachballConfigHelpers.cjs';

describe('getActionTags', () => {
  it('strips the action prefix and builds exact + major tags', () => {
    expect(getActionTags('@microsoft/beachball-action-should-release', '1.2.3')).toEqual({
      actionName: 'should-release',
      exactTag: 'should-release_v1.2.3',
      majorTag: 'should-release_v1',
    });
  });

  it('uses the major component of the version for majorTag', () => {
    expect(getActionTags('@microsoft/beachball-action-publish', '10.0.0-beta.1')).toEqual({
      actionName: 'publish',
      exactTag: 'publish_v10.0.0-beta.1',
      majorTag: 'publish_v10',
    });
  });
});

describe('getGitTag', () => {
  it('returns the default tag for non-action packages', () => {
    expect(getGitTag({ name: 'foo', version: '3.0.0' }, 'foo_v3.0.0')).toBe('foo_v3.0.0');
  });

  it('returns [exactTag, majorTag] for action packages', () => {
    expect(getGitTag({ name: '@microsoft/beachball-action-should-release', version: '1.2.3' }, 'default')).toEqual([
      'should-release_v1.2.3',
      'should-release_v1',
    ]);
  });

  it('ignores defaultTag for action packages', () => {
    expect(getGitTag({ name: '@microsoft/beachball-action-publish', version: '2.0.0' }, 'unused-default')).toEqual([
      'publish_v2.0.0',
      'publish_v2',
    ]);
  });
});

describe('postbumpHook', () => {
  let readFileSync: jest.SpiedFunction<typeof fs.readFileSync>;
  let writeFileSync: jest.SpiedFunction<typeof fs.writeFileSync>;
  let consoleLog: jest.SpiedFunction<typeof console.log>;

  beforeAll(() => {
    // Spying directly on fs methods seems to work since the tested file is CJS?
    readFileSync = jest.spyOn(fs, 'readFileSync');
    writeFileSync = jest.spyOn(fs, 'writeFileSync');
    consoleLog = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  beforeEach(() => {
    readFileSync.mockImplementation(() => '');
    writeFileSync.mockImplementation(() => undefined);
  });

  it('does nothing for non-action packages', () => {
    postbumpHook('/some/path', 'beachball', '3.0.0');

    expect(readFileSync).not.toHaveBeenCalled();
    expect(writeFileSync).not.toHaveBeenCalled();
    expect(consoleLog).not.toHaveBeenCalled();
  });

  it('replaces existing major-version references with the new majorTag', () => {
    readFileSync.mockReturnValueOnce(
      [
        '# should-release action',
        'Use `uses: microsoft/beachball/actions/should-release@should-release_v1` in your workflow.',
        'Older: microsoft/beachball/actions/should-release@should-release_v0.',
      ].join('\n')
    );

    postbumpHook('/repo/actions/should-release', '@microsoft/beachball-action-should-release', '2.0.0');

    expect(readFileSync).toHaveBeenCalledWith('/repo/actions/should-release/README.md', 'utf8');
    expect(writeFileSync).toHaveBeenCalledWith(
      '/repo/actions/should-release/README.md',
      [
        '# should-release action',
        'Use `uses: microsoft/beachball/actions/should-release@should-release_v2` in your workflow.',
        'Older: microsoft/beachball/actions/should-release@should-release_v2.',
      ].join('\n')
    );

    expect(consoleLog).toHaveBeenCalledWith(
      'Updating README.md for @microsoft/beachball-action-should-release to use new tag should-release_v2'
    );
  });

  it('writes the file unchanged when no matching tags are present', () => {
    readFileSync.mockReturnValueOnce('readme with no tag references');

    postbumpHook('/repo/packages/publish', '@microsoft/beachball-action-publish', '5.1.0');

    expect(writeFileSync).toHaveBeenCalledWith('/repo/packages/publish/README.md', 'readme with no tag references');
  });

  it('does not rewrite tags belonging to a different action', () => {
    readFileSync.mockReturnValueOnce('See also publish_v1 for the publish action.');

    postbumpHook('/repo/packages/should-release', '@microsoft/beachball-action-should-release', '2.0.0');

    expect(writeFileSync).toHaveBeenCalledWith(
      '/repo/packages/should-release/README.md',
      'See also publish_v1 for the publish action.'
    );
  });
});
