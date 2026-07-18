import { jest, describe, it, expect, beforeEach, beforeAll } from '@jest/globals';
import fs from 'fs';
import { getActionTags, getGitTag, postbumpHook } from './beachballConfigHelpers.cjs';
import path from 'path';

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
  it('returns the default tag for non-action, non-skill packages', () => {
    expect(getGitTag({ name: 'foo', version: '3.0.0' }, 'foo_v3.0.0')).toBe('foo_v3.0.0');
  });

  it('returns [exactTag, majorTag] for action packages', () => {
    expect(getGitTag({ name: '@microsoft/beachball-action-should-release', version: '1.2.3' }, 'default')).toEqual([
      'should-release_v1.2.3',
      'should-release_v1',
    ]);
  });

  it('returns tag for skill package', () => {
    expect(getGitTag({ name: '@microsoft/beachball-change-file-skill', version: '1.0.4' }, 'default')).toBe(
      'skill_v1.0.4'
    );
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

  it('does nothing for non-action, non-skill packages', () => {
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

    const packagePath = path.resolve('/repo/actions/should-release');
    postbumpHook(packagePath, '@microsoft/beachball-action-should-release', '2.0.0');

    expect(readFileSync).toHaveBeenCalledWith(path.join(packagePath, 'README.md'), 'utf8');
    expect(writeFileSync).toHaveBeenCalledWith(
      path.join(packagePath, 'README.md'),
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

    const packagePath = path.resolve('/repo/packages/publish');
    postbumpHook(packagePath, '@microsoft/beachball-action-publish', '5.1.0');

    expect(writeFileSync).toHaveBeenCalledWith(path.join(packagePath, 'README.md'), 'readme with no tag references');
  });

  it('does not rewrite tags belonging to a different action', () => {
    readFileSync.mockReturnValueOnce('See also publish_v1 for the publish action.');

    const packagePath = path.resolve('/repo/packages/should-release');
    postbumpHook(packagePath, '@microsoft/beachball-action-should-release', '2.0.0');

    expect(writeFileSync).toHaveBeenCalledWith(
      path.join(packagePath, 'README.md'),
      'See also publish_v1 for the publish action.'
    );
  });

  it('replaces existing yarn plugin tag references with the new version', () => {
    readFileSync.mockReturnValueOnce(
      '# yarn-plugin-npmrc\n' +
        'yarn plugin import https://raw.githubusercontent.com/microsoft/beachball/yarn-plugin-npmrc_v0.4.1/yarn-plugins/npmrc/dist/plugin.js'
    );

    const packagePath = path.resolve('/repo/yarn-plugins/npmrc');
    postbumpHook(packagePath, '@microsoft/beachball-yarn-plugin-npmrc', '0.4.2');

    expect(readFileSync).toHaveBeenCalledWith(path.join(packagePath, 'README.md'), 'utf8');
    expect(writeFileSync).toHaveBeenCalledWith(
      path.join(packagePath, 'README.md'),
      '# yarn-plugin-npmrc\n' +
        'yarn plugin import https://raw.githubusercontent.com/microsoft/beachball/yarn-plugin-npmrc_v0.4.2/yarn-plugins/npmrc/dist/plugin.js',
      'utf8'
    );

    expect(consoleLog).toHaveBeenCalledWith(
      'Updating README.md for @microsoft/beachball-yarn-plugin-npmrc to use new tag yarn-plugin-npmrc_v0.4.2'
    );
  });

  it('replaces skill version in SKILL.md frontmatter', () => {
    const skillMdContent = `---
name: beachball-change-file
description: How to create a Beachball change file. ONLY use this skill when the user asks to generate change files, before pushing a branch, or before creating a PR.
license: MIT
metadata:
  version: 1.0.3
  source: https://github.com/microsoft/beachball/blob/main/skills/beachball-change-file/SKILL.md
---

some skill content`;
    readFileSync.mockReturnValueOnce(skillMdContent);

    const skillsPath = path.resolve('/repo/skills');
    postbumpHook(skillsPath, '@microsoft/beachball-change-file-skill', '1.0.4');
    expect(writeFileSync).toHaveBeenCalledWith(
      path.join(skillsPath, 'beachball-change-file/SKILL.md'),
      skillMdContent.replace('version: 1.0.3', 'version: 1.0.4')
    );
  });
});
