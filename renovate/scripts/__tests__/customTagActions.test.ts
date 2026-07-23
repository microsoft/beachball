import { describe, it, expect } from '@jest/globals';
import { readPresets } from '../utils/readPresets.ts';

/* eslint-disable @typescript-eslint/no-non-null-assertion -- intentionally error if the preset shape is wrong */
const customTagPreset = readPresets().find(p => p.name === 'customTagActions')!.json;

const customManager = customTagPreset.customManagers![0];
// The two match strings: digest pin + tag comment, then plain tag ref
const [tagRe, digestRe] = customManager.matchStrings!.map(s => new RegExp(s));
// versioningTemplate is prefixed with "regex:"
const versioningRe = new RegExp(customManager.versioningTemplate!.replace(/^regex:/, ''));
// matchCurrentValue is wrapped in slashes to indicate a regex
const disableRule = customTagPreset.packageRules!.find(r => r.matchCurrentValue)!;
const disableValueRe = new RegExp(disableRule.matchCurrentValue!.replace(/^\/|\/$/g, ''));
/* eslint-enable @typescript-eslint/no-non-null-assertion */

const sha = '826cebb873f064d29134f1bbf39f2b7634cb47cb';
const actionPath = 'microsoft/beachball/actions/should-release';
const shortPath = 'foo/actions/bar';

describe('customTagActions', () => {
  describe('tag-ref match string', () => {
    /** Match `tagRe` against the action reference with semi-realistic context */
    function getTagMatch(actionRef: string) {
      return tagRe.exec(`stuff\nuses: ${actionRef}\nnext`);
    }

    it('supports a plain tag ref', () => {
      const match = getTagMatch(`${actionPath}@should-release_v3`);
      expect(match?.groups).toEqual({
        depName: 'microsoft/beachball/actions/should-release',
        packageName: 'microsoft/beachball',
        currentValue: 'should-release_v3',
      });
    });

    it('supports a major.minor.patch tag ref', () => {
      const match = getTagMatch(`${actionPath}@should-release_v1.2.3`);
      expect(match?.groups).toEqual({
        depName: 'microsoft/beachball/actions/should-release',
        packageName: 'microsoft/beachball',
        currentValue: 'should-release_v1.2.3',
      });
    });

    it('supports single folder with tag ref', () => {
      const match = getTagMatch(`${shortPath}@bar_v3`);
      expect(match?.groups).toEqual({
        depName: 'foo/actions/bar',
        packageName: 'foo/actions',
        currentValue: 'bar_v3',
      });
    });

    it('does not match a digest-pinned ref', () => {
      expect(getTagMatch(`${actionPath}@${sha} # should-release_v3`)).toBeNull();
    });

    it('does not match a prerelease tag ref', () => {
      // could maybe be added if needed, but it complicates the regex
      expect(getTagMatch(`${actionPath}@should-release_v3-beta`)).toBeNull();
    });

    it('does not match a ref without a newline', () => {
      expect(tagRe.exec(`uses: ${actionPath}@should-release_v3`)).toBeNull();
    });

    it('does not match a top-level action tag ref', () => {
      expect(getTagMatch('actions/checkout@v4')).toBeNull();
    });
  });

  describe('digest-pinned match string', () => {
    /** Match `digestRe` against the action reference with semi-realistic context */
    function getDigestMatch(actionRef: string) {
      return digestRe.exec(`stuff\nuses: ${actionRef}\nnext`);
    }

    it('supports a major version tag comment', () => {
      const match = getDigestMatch(`microsoft/beachball/actions/should-release@${sha} # should-release_v3`);
      expect(match?.groups).toEqual({
        depName: 'microsoft/beachball/actions/should-release',
        packageName: 'microsoft/beachball',
        currentDigest: sha,
        currentValue: 'should-release_v3',
      });
    });

    it('supports a major.minor.patch tag comment', () => {
      const match = getDigestMatch(`microsoft/beachball/actions/should-release@${sha} # should-release_v1.2.3`);
      expect(match?.groups).toEqual({
        depName: 'microsoft/beachball/actions/should-release',
        packageName: 'microsoft/beachball',
        currentDigest: sha,
        currentValue: 'should-release_v1.2.3',
      });
    });

    it('supports single folder with tag ref', () => {
      const match = getDigestMatch(`foo/actions/bar@${sha} # bar_v3`);
      expect(match?.groups).toEqual({
        depName: 'foo/actions/bar',
        packageName: 'foo/actions',
        currentDigest: sha,
        currentValue: 'bar_v3',
      });
    });

    it('requires the comment on the same line as the ref', () => {
      // The comment is on the following line, so it must not be matched
      expect(getDigestMatch(`microsoft/beachball/actions/should-release@${sha}\n# should-release_v3`)).toBeNull();
    });

    it('does not match a digest pin without a version comment', () => {
      expect(getDigestMatch(`microsoft/beachball/actions/should-release@${sha}`)).toBeNull();
    });

    it('does not match a comment without a newline', () => {
      expect(digestRe.exec(`uses: microsoft/beachball/actions/should-release@${sha} # should-release_v3`)).toBeNull();
    });

    it('does not match a top-level action', () => {
      expect(getDigestMatch(`actions/checkout@${sha} # v7`)).toBeNull();
    });

    it('does not match a subdir action with a plain version comment', () => {
      // e.g. github/codeql-action/init uses a normal `# v3` comment, handled by the built-in manager
      expect(getDigestMatch(`github/codeql-action/init@${sha} # v3`)).toBeNull();
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

    it.each(['should-release_v3', 'should-release_v1.2.3'])('matches custom tag value %s', value => {
      expect(disableValueRe.test(value)).toBe(true);
    });

    it.each(['v7', '1.2.3', 'should-release_v3-beta'])('does not match unrelated value %s', value => {
      expect(disableValueRe.test(value)).toBe(false);
    });
  });
});
