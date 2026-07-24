import { describe, it, expect } from '@jest/globals';
import { readPresets } from '../utils/readPresets.ts';

/* eslint-disable @typescript-eslint/no-non-null-assertion -- intentionally error if the preset shape is wrong */
const customTagPreset = readPresets().find(p => p.name === 'customTagActions')!.json;

const regExp = (s: string) => {
  // emulate re2 behavior with inline multiline flag
  // (omit renovate's `g` flag to avoid stateful behavior)
  const multiline = s.startsWith('(?m)');
  return new RegExp(multiline ? s.slice(4) : s, multiline ? 'm' : undefined);
};

const customManager = customTagPreset.customManagers![0];
const [tagRe, digestRe] = customManager.matchStrings!.map(regExp);
// versioningTemplate is prefixed with "regex:"
const versioningRe = regExp(customManager.versioningTemplate!.replace(/^regex:/, ''));
// matchCurrentValue is wrapped in slashes to indicate a regex
const disableRule = customTagPreset.packageRules!.find(r => r.matchCurrentValue)!;
const disableValueRe = regExp(disableRule.matchCurrentValue!.slice(1, -1));
/* eslint-enable @typescript-eslint/no-non-null-assertion */

const sha = '826cebb873f064d29134f1bbf39f2b7634cb47cb';
const actionPath = 'microsoft/beachball/actions/should-release';
const shortPath = 'foo/actions/bar';

describe('customTagActions', () => {
  describe('tag-ref match string', () => {
    it('supports a plain tag ref', () => {
      const match = tagRe.exec(`uses: ${actionPath}@should-release_v3`);
      expect(match?.groups).toEqual({
        depName: 'microsoft/beachball/actions/should-release',
        packageName: 'microsoft/beachball',
        currentValue: 'should-release_v3',
      });
    });

    it('supports a major.minor.patch tag ref', () => {
      const match = tagRe.exec(`uses: ${actionPath}@should-release_v1.2.3`);
      expect(match?.groups).toEqual({
        depName: 'microsoft/beachball/actions/should-release',
        packageName: 'microsoft/beachball',
        currentValue: 'should-release_v1.2.3',
      });
    });

    it('supports single folder with tag ref', () => {
      const match = tagRe.exec(`uses: ${shortPath}@bar_v3`);
      expect(match?.groups).toEqual({
        depName: 'foo/actions/bar',
        packageName: 'foo/actions',
        currentValue: 'bar_v3',
      });
    });

    it('supports tag ref with surrounding content', () => {
      const match = tagRe.exec(`stuff\nuses: ${actionPath}@should-release_v3\nnext`);
      expect(match).not.toBeNull();
    });

    it('supports indented tag ref', () => {
      const match = tagRe.exec(`stuff\n \t uses: ${actionPath}@should-release_v3\nnext`);
      expect(match).not.toBeNull();
    });

    it('supports tag ref with comment after', () => {
      const match = tagRe.exec(`uses: ${actionPath}@should-release_v3 # comment`);
      expect(match).not.toBeNull();
    });

    it('does not match a digest-pinned ref', () => {
      expect(tagRe.exec(`uses: ${actionPath}@${sha} # should-release_v3`)).toBeNull();
    });

    it('does not match a prerelease tag ref', () => {
      // could maybe be added if needed, but it complicates the regex
      expect(tagRe.exec(`uses: ${actionPath}@should-release_v3.2.1-beta`)).toBeNull();
    });

    it('does not match a top-level action tag ref', () => {
      expect(tagRe.exec(`uses: actions/checkout@v4`)).toBeNull();
    });
  });

  describe('digest-pinned match string', () => {
    it('supports a major version tag comment', () => {
      const match = digestRe.exec(`uses: microsoft/beachball/actions/should-release@${sha} # should-release_v3`);
      expect(match?.groups).toEqual({
        depName: 'microsoft/beachball/actions/should-release',
        packageName: 'microsoft/beachball',
        currentDigest: sha,
        currentValue: 'should-release_v3',
      });
    });

    it('supports a major.minor.patch tag comment', () => {
      const match = digestRe.exec(`uses: microsoft/beachball/actions/should-release@${sha} # should-release_v1.2.3`);
      expect(match?.groups).toEqual({
        depName: 'microsoft/beachball/actions/should-release',
        packageName: 'microsoft/beachball',
        currentDigest: sha,
        currentValue: 'should-release_v1.2.3',
      });
    });

    it('supports single folder with tag ref', () => {
      const match = digestRe.exec(`uses: foo/actions/bar@${sha} # bar_v3`);
      expect(match?.groups).toEqual({
        depName: 'foo/actions/bar',
        packageName: 'foo/actions',
        currentDigest: sha,
        currentValue: 'bar_v3',
      });
    });

    it('supports tag ref with surrounding content', () => {
      const match = digestRe.exec(`stuff\nuses: ${actionPath}@${sha} # should-release_v3\nnext`);
      expect(match).not.toBeNull();
    });

    it('supports indented tag ref', () => {
      const match = digestRe.exec(`stuff\n  uses: ${actionPath}@${sha} # should-release_v3\nnext`);
      expect(match).not.toBeNull();
    });

    it('requires the comment on the same line as the ref', () => {
      // The comment is on the following line, so it must not be matched
      expect(digestRe.exec(`uses: microsoft/beachball/actions/should-release@${sha}\n# should-release_v3`)).toBeNull();
    });

    it('does not match a digest pin without a version comment', () => {
      expect(digestRe.exec(`uses: microsoft/beachball/actions/should-release@${sha}`)).toBeNull();
    });

    it('does not match a top-level action', () => {
      expect(digestRe.exec(`uses: actions/checkout@${sha} # v7`)).toBeNull();
    });

    it('does not match a subdir action with a plain version comment', () => {
      // e.g. github/codeql-action/init uses a normal `# v3` comment, handled by the built-in manager
      expect(digestRe.exec(`uses: github/codeql-action/init@${sha} # v3`)).toBeNull();
    });
  });

  describe('versioning template', () => {
    it('parses a major-only tag', () => {
      expect(versioningRe.exec('should-release_v3')?.groups).toEqual({
        compatibility: 'should-release',
        major: '3',
      });
    });

    it('parses a major.minor.patch tag', () => {
      expect(versioningRe.exec('should-release_v1.2.3')?.groups).toEqual({
        compatibility: 'should-release',
        major: '1',
        minor: '2',
        patch: '3',
      });
    });

    it('uses the action name as the compatibility to keep tag families separate', () => {
      expect(versioningRe.exec('check-for-modified-files_v3')?.groups?.compatibility).toBe('check-for-modified-files');
    });

    it('rejects a value with a non-numeric suffix', () => {
      expect(versioningRe.test('should-release_v3-beta')).toBe(false);
    });

    it('rejects a plain version without the name prefix', () => {
      expect(versioningRe.test('v3')).toBe(false);
    });
  });

  describe('github-actions disable rule', () => {
    it('only disables the built-in github-actions manager', () => {
      expect(disableRule.matchManagers).toEqual(['github-actions']);
      expect(disableRule.enabled).toBe(false);
    });

    it('matches custom tag with full version', () => {
      expect(disableValueRe.test('should-release_v1.2.3')).toBe(true);
    });

    it('matches custom tag with major-only version', () => {
      expect(disableValueRe.test('should-release_v3')).toBe(true);
    });

    it('does not match custom tag with prerelease', () => {
      expect(disableValueRe.test('should-release_v3.2.1-beta')).toBe(false);
    });

    it.each(['v7', 'v1.2.3', '1.2.3'])('does not match other value %s', value => {
      expect(disableValueRe.test(value)).toBe(false);
    });
  });
});
