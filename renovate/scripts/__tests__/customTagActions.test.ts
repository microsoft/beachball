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

// A single manager handles both major-only (foo_v1) and full semver (foo_v1.2.3) tags.
const [manager] = customTagPreset.customManagers!;
const [tagRe, digestRe] = manager.matchStrings!.map(regExp);
// The versioningTemplate is a single regex whose `.<minor>.<patch>` part is gated by a Handlebars
// conditional on whether the captured `version` contains a `.`. Render both branches.
const versioningTemplate = manager.versioningTemplate!.replace(/^regex:/, '');
const fullVersioningRe = new RegExp(versioningTemplate.replace(/{{#if.*?}}|{{\/if}}/g, ''));
const majorVersioningRe = new RegExp(versioningTemplate.replace(/{{#if.*?}}.*?{{\/if}}/g, ''));
// Mimic Renovate's per-dependency template selection: `.` in the version => full-semver scheme.
const chooseVersioningRe = (version: string) => (version.includes('.') ? fullVersioningRe : majorVersioningRe);
// matchCurrentValue is wrapped in slashes to indicate a regex
const disableRule = customTagPreset.packageRules!.find(r => r.matchCurrentValue)!;
const disableValueRe = regExp(disableRule.matchCurrentValue!.slice(1, -1));
/* eslint-enable @typescript-eslint/no-non-null-assertion */

const sha = '826cebb873f064d29134f1bbf39f2b7634cb47cb';
const actionPath = 'microsoft/beachball/actions/should-release';
const shortPath = 'foo/actions/bar';

describe('customTagActions', () => {
  describe('tag-ref match string', () => {
    it('supports a plain major-only tag ref', () => {
      const match = tagRe.exec(`uses: ${actionPath}@should-release_v3`);
      expect(match?.groups).toEqual({
        depName: 'microsoft/beachball/actions/should-release',
        packageName: 'microsoft/beachball',
        currentValue: 'should-release_v3',
        version: '3',
      });
    });

    it('supports a major.minor.patch tag ref', () => {
      const match = tagRe.exec(`uses: ${actionPath}@should-release_v1.2.3`);
      expect(match?.groups).toEqual({
        depName: 'microsoft/beachball/actions/should-release',
        packageName: 'microsoft/beachball',
        currentValue: 'should-release_v1.2.3',
        version: '1.2.3',
      });
    });

    it('supports single folder with tag ref', () => {
      const match = tagRe.exec(`uses: ${shortPath}@bar_v3`);
      expect(match?.groups).toEqual({
        depName: 'foo/actions/bar',
        packageName: 'foo/actions',
        currentValue: 'bar_v3',
        version: '3',
      });
    });

    it('supports the YAML list-item step form (- uses:)', () => {
      const match = tagRe.exec(`    - uses: ${actionPath}@should-release_v3`);
      expect(match?.groups?.currentValue).toBe('should-release_v3');
    });

    it.each(['"', "'"])('supports a quoted scalar value (%s)', quote => {
      const match = tagRe.exec(`    - uses: ${quote}${actionPath}@should-release_v3${quote}`);
      expect(match?.groups?.currentValue).toBe('should-release_v3');
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

    it('does not match a major.minor tag ref', () => {
      expect(tagRe.exec(`uses: ${actionPath}@should-release_v1.2`)).toBeNull();
    });

    it('does not match a digest-pinned ref', () => {
      expect(tagRe.exec(`uses: ${actionPath}@${sha} # should-release_v3`)).toBeNull();
    });

    it('does not match a prerelease tag ref', () => {
      expect(tagRe.exec(`uses: ${actionPath}@should-release_v3-beta`)).toBeNull();
    });

    it('does not match a top-level action tag ref', () => {
      expect(tagRe.exec(`uses: actions/checkout@v4`)).toBeNull();
    });
  });

  describe('digest-pinned match string', () => {
    it('supports a major version tag comment', () => {
      const match = digestRe.exec(`uses: ${actionPath}@${sha} # should-release_v3`);
      expect(match?.groups).toEqual({
        depName: 'microsoft/beachball/actions/should-release',
        packageName: 'microsoft/beachball',
        currentDigest: sha,
        currentValue: 'should-release_v3',
        version: '3',
      });
    });

    it('supports a major.minor.patch tag comment', () => {
      const match = digestRe.exec(`uses: ${actionPath}@${sha} # should-release_v1.2.3`);
      expect(match?.groups).toEqual({
        depName: 'microsoft/beachball/actions/should-release',
        packageName: 'microsoft/beachball',
        currentDigest: sha,
        currentValue: 'should-release_v1.2.3',
        version: '1.2.3',
      });
    });

    it('supports single folder with tag ref', () => {
      const match = digestRe.exec(`uses: foo/actions/bar@${sha} # bar_v3`);
      expect(match?.groups?.currentValue).toBe('bar_v3');
    });

    it('supports the YAML list-item step form (- uses:)', () => {
      const match = digestRe.exec(`    - uses: ${actionPath}@${sha} # should-release_v3`);
      expect(match?.groups?.currentValue).toBe('should-release_v3');
    });

    it.each(['"', "'"])('supports a quoted scalar value (%s), comment outside the quotes', quote => {
      const match = digestRe.exec(`    - uses: ${quote}${actionPath}@${sha}${quote} # should-release_v3`);
      expect(match?.groups?.currentValue).toBe('should-release_v3');
    });

    it('supports indented tag ref with surrounding content', () => {
      const match = digestRe.exec(`stuff\n  uses: ${actionPath}@${sha} # should-release_v3\nnext`);
      expect(match).not.toBeNull();
    });

    it('requires the comment on the same line as the ref', () => {
      expect(digestRe.exec(`uses: ${actionPath}@${sha}\n# should-release_v3`)).toBeNull();
    });

    it('does not match a digest pin without a version comment', () => {
      expect(digestRe.exec(`uses: ${actionPath}@${sha}`)).toBeNull();
    });

    it('does not match a top-level action', () => {
      expect(digestRe.exec(`uses: actions/checkout@${sha} # v7`)).toBeNull();
    });

    it('does not match a subdir action with a plain version comment', () => {
      // e.g. github/codeql-action/init uses a normal `# v3` comment, handled by the built-in manager
      expect(digestRe.exec(`uses: github/codeql-action/init@${sha} # v3`)).toBeNull();
    });
  });

  describe('conditional versioning template', () => {
    it('selects the major-only scheme for a major-only pin and parses it', () => {
      const groups = chooseVersioningRe('3').exec('should-release_v3')?.groups;
      expect(groups).toEqual({ compatibility: 'should-release', major: '3' });
    });

    it('selects the full-semver scheme for a full pin and parses it', () => {
      const groups = chooseVersioningRe('1.2.3').exec('should-release_v1.2.3')?.groups;
      expect(groups).toEqual({ compatibility: 'should-release', major: '1', minor: '2', patch: '3' });
    });

    it('is not fooled by a dot in the action name (dotted name, major-only version)', () => {
      // `version` is only the numeric part, so a dotted action name still uses the major-only scheme
      expect(chooseVersioningRe('3').exec('foo.bar_v3')?.groups).toEqual({ compatibility: 'foo.bar', major: '3' });
    });

    it('uses the action name as the compatibility to keep tag families separate', () => {
      expect(chooseVersioningRe('3').exec('check-for-modified-files_v3')?.groups?.compatibility).toBe(
        'check-for-modified-files'
      );
    });

    it('major-only scheme rejects a full semver tag (so it is not offered as an upgrade)', () => {
      expect(majorVersioningRe.exec('should-release_v1.2.3')).toBeNull();
    });

    it('full-semver scheme rejects a major-only tag', () => {
      expect(fullVersioningRe.exec('should-release_v3')).toBeNull();
    });

    it('rejects a plain version without the name prefix', () => {
      expect(majorVersioningRe.exec('v3')).toBeNull();
      expect(fullVersioningRe.exec('v1.2.3')).toBeNull();
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
